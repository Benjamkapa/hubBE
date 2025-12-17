# Fix PayloadTooLargeError for Image Uploads in PUT /api/services/:id

## Steps to Complete:

- [x] Increase payload limits in src/index.ts to "10mb" for express.json and express.urlencoded
- [x] Add upload.single("image") middleware to PUT route in src/routes/services.ts
- [ ] Remove body("image") validation from PUT route in src/routes/services.ts
- [x] Update PUT route logic to handle req.file for image filename
- [x] Test the fix by running the server and attempting the image upload
