const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const { google } = require("googleapis");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const { Storage } = require("@google-cloud/storage");
const path = require("path");
const axios = require("axios");
const { file } = require("googleapis/build/src/apis/file");
const pathKey = path.resolve(__dirname, "./serviceaccountkey.json");
const storage = new Storage({
  projectId: "apiecocycle",
  keyFilename: pathKey,
});

const bucketName = "upload-image-url";
const bucket = storage.bucket(bucketName);

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();
app.use(fileUpload());

app.get("/", (req, res) => {
  console.log("Response success");
  res.send("Response traffic 2 Success!");
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:5000/auth/google/callback"
);

const scopes = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const authorizationUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
  include_granted_scopes: true,
});

app.use(express.json());

const accessValidation = (req, res, next) => {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(401).json({
      message: "Token diperlukan",
    });
  }

  const token = authorization.split(" ")[1];
  const secret = process.env.JWT_SECRET;

  try {
    const jwtDecode = jwt.verify(token, secret);
    req.userData = jwtDecode;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
      });
    } else {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }
  }
};

app.get("/auth/google", (req, res) => {
  res.redirect(authorizationUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;

  const { tokens } = await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: "v2",
  });

  const { data } = await oauth2.userinfo.get();

  if (!data.email || !data.name) {
    return res.json({
      data: data,
    });
  }

  let user = await prisma.user.findUnique({
    where: {
      email: data.email,
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
      },
    });
  }

  const payload = {
    id: user.id,
    name: user.name,
  };

  const secret = process.env.JWT_SECRET;

  const expiresIn = 60 * 60 * 1;

  const token = jwt.sign(payload, secret, { expiresIn: expiresIn });

  return res.json({
    data: {
      id: user.id,
      name: user.name,
      token: token,
    },
  });
});

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required fields" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    res.json({
      message: "User created successfully",
      user: result,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.password) {
      return res.status(404).json({
        message: "Password not set",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      const payload = {
        id: user.id,
        name: user.name,
        email: user.email,
      };

      const secret = process.env.JWT_SECRET || "your-secret-key";
      const expiresIn = 60 * 60 * 1;

      const token = jwt.sign(payload, secret, { expiresIn: expiresIn });

      return res.json({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          token: token,
        },
      });
    } else {
      return res.status(403).json({
        message: "Wrong password",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

app.post("/users/validations", accessValidation, async (req, res, next) => {
  const { name, email } = req.body;

  const result = await prisma.user.create({
    data: {
      name: name,
      email: email,
    },
  });
  res.json({
    data: result,
    message: `User created`,
  });
});

app.get("/users", async (req, res) => {
  const result = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
  res.json({
    data: result,
    message: "User list",
  });
});

app.get("/users/:id", async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      data: user,
      message: "User details",
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/users", accessValidation, async (req, res) => {
  const result = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
  res.json({
    data: result,
    message: "User list",
  });
});

app.patch("/users/:id", accessValidation, async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  const result = await prisma.user.update({
    data: {
      name: name,
      email: email,
    },
    where: {
      id: Number(id),
    },
  });
  res.json({
    data: result,
    message: `User ${id} updated`,
  });
});

app.delete("/users/:id", accessValidation, async (req, res) => {
  const { id } = req.params;

  const result = await prisma.user.delete({
    where: {
      id: Number(id),
    },
  });
  res.json({
    message: `User ${id} deleted`,
  });
});

app.post("/postimage", accessValidation, async (req, res) => {
  let responseSent = false; // Flag to track if response has been sent

  try {
    const { files, userData } = req;

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ error: "No files were uploaded." });
    }

    const image = files.image;

    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");

    // Format the date
    const formattedDate = `${year}-${month}-${day}`;

    // Apply replacement of spaces, slashes, and commas with underscores
    const replacedDate = formattedDate.replace(/[\s\/,]+/g, "_");

    const dynamicUploadPath = `uploads/${replacedDate}/`;

    // Define destination in GCS
    const destination = dynamicUploadPath + image.name;

    const gcsUploadOptions = {
      destination,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    };

    // Create a read stream from the image buffer
    const imageBuffer = image.data;
    const imageReadStream = require("stream").Readable.from(imageBuffer);

    // Upload to GCS directly
    const gcsFile = storage.bucket(bucketName).file(destination);
    const stream = gcsFile.createWriteStream(gcsUploadOptions);

    stream.on("error", (err) => {
      console.error("Error uploading to GCS:", err);

      if (!responseSent) {
        // Send the error response only if it hasn't been sent before
        res.status(500).json({ error: "Internal server error" });
        responseSent = true; // Set the flag to true
      }
    });

    stream.on("finish", async () => {
      const imageUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;

      // Image processing with external API
      try {
        const apiUrl =
          "https://asia-southeast2-apiecocycle.cloudfunctions.net/img_classifier_model";
        const response = await axios.post(apiUrl, { url: imageUrl });
        const apiResponse = response.data;

        // Additional processing if needed with apiResponse

        // Store information about the uploaded image in the database
        const result = await prisma.image.create({
          data: {
            path: imageUrl,
            userId: userData.id,
            rusty: apiResponse.Rusty,
            noRust: apiResponse["No-Rust"],
          },
        });

        if (!responseSent) {
          // Send the response only if it hasn't been sent before
          res.json({
            message: "Image uploaded and processed successfully",
            data: {
              ...result,
            },
          });
          responseSent = true; // Set the flag to true
        }
      } catch (error) {
        console.error("Error processing image:", error);

        if (!responseSent) {
          // Send the error response only if it hasn't been sent before
          res.status(500).json({ error: "Internal server error" });
          responseSent = true; // Set the flag to true
        }
      }
    });

    // Pipe the image stream to GCS
    imageReadStream.pipe(stream);
  } catch (error) {
    console.error("Error uploading image:", error);

    if (!responseSent) {
      // Send the error response only if it hasn't been sent before
      res.status(500).json({ error: "Internal server error" });
      responseSent = true; // Set the flag to true
    }
  }
});

app.get("/userimages", accessValidation, async (req, res) => {
  try {
    // Menggunakan userData dari accessValidation
    const { userData } = req;

    // Ambil userId dari userData
    const userId = userData.id;

    // Ambil semua data gambar berdasarkan userId dari database
    const userImages = await prisma.image.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: "desc", // Menambahkan orderBy untuk mengurutkan berdasarkan createdAt secara descending
      },
    });

    // Format respons sesuai dengan /postimage
    const formattedImages = userImages.map((image) => ({
      id: image.id,
      path: image.path,
      userId: image.userId,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
      rusty: image.rusty,
      noRust: image.noRust,
    }));

    // Kirim respons dengan data gambar
    res.json({
      message: `Images for userId ${userId} retrieved successfully`,
      data: formattedImages,
    });
  } catch (error) {
    console.error("Error retrieving images:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.listen(PORT, () => {
  console.log(`Server running in PORT: ${PORT}`);
});
