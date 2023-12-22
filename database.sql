-- Create User table
CREATE TABLE User (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create Image table with foreign key reference to User table
CREATE TABLE Image (
  id INT AUTO_INCREMENT PRIMARY KEY,
  path VARCHAR(255),
  userId INT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Foreign key reference to User table
  CONSTRAINT FK_Image_User FOREIGN KEY (userId) REFERENCES User(id)
);
