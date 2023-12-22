-- Tabel User
CREATE TABLE `User` (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  -- Tambahkan kolom lain sesuai kebutuhan
);

-- Tabel Image
CREATE TABLE Image (
  id INT PRIMARY KEY AUTO_INCREMENT,
  path VARCHAR(255) NOT NULL,
  userId INT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  rusty FLOAT,
  noRust FLOAT,
  FOREIGN KEY (userId) REFERENCES `User`(id)
  -- Tambahkan kolom lain sesuai kebutuhan
);
