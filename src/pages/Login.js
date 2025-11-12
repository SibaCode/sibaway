import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, userData } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (error) {
      setError('Failed to log in: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-redirect based on user role
  React.useEffect(() => {
    if (userData) {
      switch (userData.role) {
        case 'superAdmin':
          navigate('/super-admin');
          break;
        case 'orgAdmin':
          navigate('/org-admin');
          break;
        case 'student':
          navigate('/student');
          break;
        default:
          navigate('/');
      }
    }
  }, [userData, navigate]);

//   const fillDemoCredentials = (role) => {
//     switch (role) {
//       case 'superadmin':
//         setEmail('superadmin@sibaway.com');
//         setPassword('superadmin@sibaway.com');
//         break;
//       case 'orgadmin':
//         setEmail('mvubusiba@gmail.com');
//         setPassword('mvubusiba@gmail.com');
//         break;
//       default:
//         break;
//     }
//   };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-background-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>
      
      <div className="login-content">
        <form onSubmit={handleSubmit} className="login-form">
          {/* Header Section */}
          <div className="login-header">
            <div className="logo-container">
              <div className="logo-icon">🚀</div>
              <div className="logo-text">
                <h1>SibaWay</h1>
                <p>Streamline your business</p>
              </div>
            </div>
            <div className="welcome-section">
              <h2>Welcome Back!</h2>
              <p>Sign in to your admin dashboard</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <div className="error-icon">⚠️</div>
              <div className="error-text">
                <strong>Login Failed</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="form-section">
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📧</span>
                Email Address
              </label>
              <input
                type="email"
                className="form-control"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🔒</span>
                Password
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Login Button */}
            <button 
              type="submit" 
              className={`btn btn-primary login-btn ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="btn-spinner"></div>
                  Signing In...
                </>
              ) : (
                <>
                  <span className="btn-icon">→</span>
                  Sign In to Dashboard
                </>
              )}
            </button>
          </div>

          {/* Quick Access Section */}
          {/* <div className="quick-access-section">
            <div className="section-divider">
              <span>Quick Access</span>
            </div>
            
            <div className="demo-buttons">
              <button 
                type="button"
                className="demo-btn super-admin-btn"
                onClick={() => fillDemoCredentials('superadmin')}
              >
                <div className="demo-btn-icon">👑</div>
                <div className="demo-btn-content">
                  <div className="demo-btn-title">Super Admin</div>
                  <div className="demo-btn-subtitle">Full platform access</div>
                </div>
                <div className="demo-btn-arrow">→</div>
              </button>
              
              <button 
                type="button"
                className="demo-btn business-owner-btn"
                onClick={() => fillDemoCredentials('orgadmin')}
              >
                <div className="demo-btn-icon">💼</div>
                <div className="demo-btn-content">
                  <div className="demo-btn-title">Business Owner</div>
                  <div className="demo-btn-subtitle">Manage classes & students</div>
                </div>
                <div className="demo-btn-arrow">→</div>
              </button>
            </div>
          </div> */}

          {/* Footer */}
          {/* <div className="login-footer">
            <p>Secure admin portal • Powered by SibaWay</p>
          </div> */}
        </form>
      </div>
    </div>
  );
}

export default Login;