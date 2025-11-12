import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import OrgAdminDashboard from './pages/OrgAdminDashboard';
import WelcomePage from './pages/WelcomePage';
import ClassRegistration from './pages/ClassRegistration';
import Login from './pages/Login';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/super-admin" element={<SuperAdminDashboard />} />
            <Route path="/org-admin" element={<OrgAdminDashboard />} />            
            <Route path="/:businessSlug/:courseSlug/:venue/:date" element={<ClassRegistration />} />
            <Route path="/join/:classSlug" element={<ClassRegistration />} />
            <Route path="/register/:classId" element={<ClassRegistration />} />
          </Routes>
          <ToastContainer />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;