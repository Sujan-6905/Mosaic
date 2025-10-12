# Collaborative Whiteboard

![Whiteboard Hero](https://img.shields.io/badge/Status-Active-brightgreen) ![Next.js](https://img.shields.io/badge/Next.js-15.0.4-black) ![Node.js](https://img.shields.io/badge/Node.js-Express-green) ![Socket.io](https://img.shields.io/badge/Socket.io-4.8.1-blue) ![MongoDB](https://img.shields.io/badge/Database-MongoDB-green)

A real-time collaborative digital whiteboard application that enables teams to create, share, and collaborate on drawings seamlessly. Built with modern web technologies to provide a smooth, responsive drawing experience with live collaboration features.

**Live Demo**: [https://collaborative-whiteboard-alpha.vercel.app/](https://collaborative-whiteboard-alpha.vercel.app/)

*Note: The backend is deployed on Render's free tier and may take 1-2 minutes to load initially after 15 minutes of inactivity.*

## Features

### Core Functionality
- **Real-time Collaboration**: Multiple users can draw simultaneously with live updates
- **Rich Drawing Tools**: Pencil, pen, highlighter, eraser, and various shapes
- **Shape Library**: Rectangle, circle, ellipse, triangle, star, arrow, and line tools
- **Color Palette**: Extensive color selection with custom color picker
- **Canvas Controls**: Zoom in/out, pan, reset view, and fullscreen mode
- **Export Functionality**: Download whiteboards as PNG images

### Collaboration Features
- **User Authentication**: Email/password login and OAuth (Google, GitHub)
- **Ownership Management**: Drawing owners can manage collaborators
- **Access Control**: View and edit permissions for shared whiteboards
- **Real-time Synchronization**: Instant updates across all connected clients
- **Sharing**: Generate shareable links for collaborative sessions

### User Experience
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Intuitive Interface**: Clean, modern UI with floating toolbars
- **Undo/Redo**: Full action history with undo and redo capabilities
- **Canvas Grid**: Optional grid overlay for precise drawing
- **Live Element Count**: Real-time display of canvas elements

## Architecture

### Data Storage Layers

The canvas data is stored and synchronized across **three distinct levels**:

1. **Frontend State (React/Redux)**
   - Local canvas elements state managed by Redux Toolkit
   - Real-time UI updates and optimistic rendering
   - Temporary shape rendering during drawing operations
   - Undo/redo stack management

2. **Socket Server Memory (Node.js)**
   - In-memory canvas state for active sessions
   - Real-time synchronization between connected clients
   - Session management and room-based collaboration
   - Immediate broadcast of drawing operations to all participants

3. **MongoDB Database**
   - Persistent storage of canvas elements and metadata
   - User authentication and authorization data
   - Drawing ownership and collaboration permissions
   - Automatic saving when sessions end

### Technology Stack

#### Frontend
- **Framework**: Next.js 15.0.4 with React 18
- **State Management**: Redux Toolkit with RTK Query
- **Authentication**: NextAuth.js with multiple providers
- **Styling**: CSS Modules with responsive design
- **Icons**: FontAwesome React components
- **Real-time**: Socket.io client for live collaboration

#### Backend
- **Runtime**: Node.js with Express.js 5.1.0
- **Real-time**: Socket.io 4.8.1 server
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **ID Generation**: Nanoid for unique identifiers
- **Environment**: ES modules with dotenv configuration

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/collaborative-whiteboard.git
cd collaborative-whiteboard
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create `.env` file in the backend directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/whiteboard
JWT_SECRET=your_jwt_secret_key
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

Create `.env.local` file in the frontend directory:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 4. Start the Application

#### Start Backend Server
```bash
cd backend
npm run dev
```
Server will run on `http://localhost:5000`

#### Start Frontend Application
```bash
cd frontend
npm run dev
```
Application will run on `http://localhost:3000`

## Usage

### Getting Started
1. **Sign Up/Login**: Create an account or login with existing credentials
2. **Create New Whiteboard**: Click "Create New Drawing" from the dashboard
3. **Choose Tools**: Select from drawing tools, shapes, or text options
4. **Customize**: Adjust colors, brush sizes, and opacity
5. **Collaborate**: Share the whiteboard link with team members
6. **Export**: Download your creation as a PNG image

### Test Credentials
For demo purposes, use these test credentials:
- **Email**: `demo@gmail.com`
- **Password**: `password`

### Drawing Tools
- **Pencil Tools**: Pencil, pen, and highlighter with adjustable sizes
- **Shapes**: Rectangle, circle, ellipse, triangle, star, arrow, line
- **Eraser**: Remove elements with visual feedback
- **Hand Tool**: Pan around the canvas
- **Undo/Redo**: Navigate through your drawing history

### Collaboration Features
- **Share Whiteboard**: Generate shareable links for team collaboration
- **Manage Collaborators**: Add/remove users with edit permissions (owners only)
- **Real-time Updates**: See changes from other users instantly
- **Access Control**: Separate view and edit permissions

## Project Structure

```
collaborative-whiteboard/
├── frontend/                    # Next.js React application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── AuthModal/      # Authentication modal
│   │   │   ├── Dashboard/      # User dashboard
│   │   │   ├── Header/         # Navigation header
│   │   │   ├── HomePage/       # Landing page components
│   │   │   ├── Menu/           # Drawing tool menu
│   │   │   ├── Toolbox/        # Tool customization panel
│   │   │   └── Whiteboard/     # Main canvas component
│   │   ├── pages/              # Next.js pages and API routes
│   │   │   ├── api/auth/       # NextAuth configuration
│   │   │   ├── dashboard.js    # User dashboard page
│   │   │   ├── about.js        # About page
│   │   │   └── index.js        # Main application page
│   │   ├── slice/              # Redux state slices
│   │   ├── styles/             # Global styles
│   │   ├── axiosInstance.js    # API client configuration
│   │   ├── constants.js        # Application constants
│   │   ├── socket.js           # Socket.io client setup
│   │   └── store.js            # Redux store configuration
│   ├── package.json
│   └── next.config.mjs
└── backend/                     # Node.js Express server
    ├── controllers/            # Business logic handlers
    │   ├── authController.js   # Authentication operations
    │   └── drawingController.js # Canvas operations
    ├── middlewares/            # Express middlewares
    │   ├── authMiddleware.js   # JWT authentication
    │   └── checkAccess.js      # Permission validation
    ├── models/                 # MongoDB schemas
    │   ├── drawingSchema.js    # Canvas data model
    │   └── userSchema.js       # User data model
    ├── routes/                 # API endpoints
    │   ├── authRoutes.js       # Authentication routes
    │   └── drawingRoutes.js    # Canvas routes
    ├── db.js                   # Database connection
    ├── index.js                # Express server setup
    ├── socket.js               # Socket.io server logic
    └── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/oauth-login` - OAuth authentication

### Drawings
- `GET /api/drawing/` - Get user's drawings
- `POST /api/drawing/` - Create new drawing
- `GET /api/drawing/:shareId` - Get specific drawing
- `PUT /api/drawing/:shareId` - Update drawing title
- `DELETE /api/drawing/:shareId` - Delete drawing
- `PUT /api/drawing/collaborators/:shareId` - Add collaborator
- `DELETE /api/drawing/collaborators/:shareId` - Remove collaborator

### Socket.io Events
- `client:createCanvas` - Create new canvas session
- `client:joinRoom` - Join existing canvas session
- `client:updateCanvas` - Broadcast drawing operations
- `server:addNewElement` - Receive new elements
- `server:deleteElement` - Receive element deletions

## Deployment

### Environment Configuration
Ensure all environment variables are properly configured for production:
- Database connection strings
- JWT secrets
- OAuth provider credentials
- CORS origins for production domains

### Production Deployment
This application is currently deployed with the following setup:
- **Frontend**: Deployed on Vercel at [https://collaborative-whiteboard-alpha.vercel.app/](https://collaborative-whiteboard-alpha.vercel.app/)
- **Backend**: Deployed on Render (free tier)
- **Database**: MongoDB Atlas

**Important Note**: The backend on Render's free tier goes to sleep after 15 minutes of inactivity and may take 1-2 minutes to wake up on the first request. Please be patient during the initial load.

The application architecture supports deployment on:
- **Frontend**: Vercel, Netlify, or any static hosting platform
- **Backend**: Render, Railway, Heroku, or VPS
- **Database**: MongoDB Atlas or self-hosted MongoDB

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- **Socket.io** for real-time communication
- **Next.js** for the amazing React framework
- **MongoDB** for flexible data storage
- **FontAwesome** for beautiful icons
- **NextAuth.js** for authentication solutions

## Support

For support, questions, or feature requests, please open an issue on GitHub or contact the development team.

---

**Built for creative teams everywhere**