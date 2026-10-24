// File uploads for submissions (PDF / Word), stored on disk with multer.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // Random name on disk; the original name is kept in the database for downloads.
    filename: (req, file, cb) =>
      cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    // Browsers send the file name as latin1; decode it so names like "résumé.pdf" survive.
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
  },
});

// Accepts one optional "file" field and turns multer errors into 400 responses.
function singleFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large (max 10 MB)' });
    if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Only PDF, DOC and DOCX files are allowed' });
    next(err);
  });
}

const filePath = (storedName) => path.join(UPLOAD_DIR, storedName);

// Deletes a stored file; a missing file is not an error.
function removeFile(storedName) {
  if (storedName) fs.rmSync(filePath(storedName), { force: true });
}

module.exports = { singleFile, filePath, removeFile };
