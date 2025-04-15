# UtilityAPI - Media Processing Suite

UtilityAPI is a comprehensive media processing platform that provides powerful video and audio transformation capabilities through both a web interface and a RESTful API.

## 🚀 Features

### Currently Available

- **Video Watermarking**: Add custom text watermarks to your videos with full customization options
- **Split Screen Generator**: Combine multiple videos into various split-screen layouts (2x2, 1x2, 2x1)
- **User Authentication**: Secure login/signup system with JWT and session-based authentication
- **API Key Management**: Generate and manage API keys for programmatic access
- **Usage Tracking**: Monitor API usage across different pricing tiers

### Coming Soon

- **Video Compression**: Compress videos while maintaining quality
- **Format Conversion**: Convert between popular video formats
- **Audio Processing**: Clean and enhance audio, create visualizations
- **Advanced Video Editing**: Generate highlight reels, timelapses, and more
- **Streaming Solutions**: RTMP streaming server and webcam effects

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (with Mongoose)
- **Authentication**: Passport.js, JWT, bcrypt
- **Media Processing**: FFmpeg
- **Frontend**: EJS templates, TailwindCSS
- **File Handling**: Multer

## ⚙️ Installation

1. Clone the repository

   ```
   git clone https://github.com/ComradeZeusman/Utilities_api
   cd utilities-api
   ```

2. Install dependencies

   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables

   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=90d
   JWT_COOKIE_EXPIRES_IN=90
   SESSION_SECRET=your_session_secret
   NODE_ENV=development
   ```

4. Install FFmpeg (required for video processing)

   - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH
   - Mac: `brew install ffmpeg`
   - Ubuntu: `sudo apt install ffmpeg`

5. Create required directories

   ```
   mkdir -p uploads/videos uploads/images uploads/documents temp
   ```

6. Start the server

   ```
   npm run dev
   ```

7. Access the application at `http://localhost:3000`

## 📚 API Documentation

Detailed API documentation is available at `/Documentation` when the server is running.

### Authentication

Include your API key in the request header:

```
x-api-key: your_api_key_here
```

### Endpoints

#### Video Watermarking

```
POST /watermark
```

Parameters:

- `video` (File, required): The video file to watermark
- `text` (String, optional): Watermark text (defaults to "Watermark")

#### Split Screen

```
POST /split-screen
```

Parameters:

- `videos` (File Array, required): An array of video files (2-4 files)
- `layout` (String, optional): Layout type: "2x2" (default), "1x2", or "2x1"

## 💰 Pricing Plans

- **Free**: Limited access, watermarking demo only
- **Basic**: 100 requests/month, all features
- **Pro**: 300 requests/month, all features, priority support

## 🧪 Development

```
npm run dev
```

## 🔒 Security

This application implements:

- Password hashing with bcrypt
- JWT authentication
- Session management
- API key authentication
- Input validation and sanitization

## 👥 Contributing

Contributions are welcome! Here's how you can contribute to UtilityAPI:

1. **Fork the repository**

   - Create your own copy of the project to work on

2. **Create a feature branch**

   ```
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**

   - Add new features
   - Fix bugs
   - Improve documentation
   - Add tests

4. **Follow the coding standards**

   - Keep the code style consistent
   - Comment your code where necessary
   - Write meaningful commit messages

5. **Test your changes**

   - Ensure your code works as expected
   - Check for any errors or bugs

6. **Submit a pull request**

   - Provide a clear description of the changes
   - Link any related issues

7. **Areas where help is needed**
   - UI/UX improvements
   - Additional video processing features
   - Performance optimizations
   - Testing and bug fixes
   - Documentation improvements

For major changes, please open an issue first to discuss what you would like to change.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
