import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function Navbar() {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      // Redirect to login page after successful logout
      navigate('/login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span>🚀 SibaWay</span>
      </div>
      <ul className="navbar-nav">
        {userData?.role === 'orgAdmin' && (
          <>
            <li><a href="#classes">My Classes</a></li>
            <li><a href="#registrations">Registrations</a></li>
          </>
        )}
        {userData?.role === 'superAdmin' && (
          <li><a href="#organizations">Organizations</a></li>
        )}
        <li>
          <button onClick={handleLogout} className="btn btn-outline">
            Logout ({userData?.name})
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;