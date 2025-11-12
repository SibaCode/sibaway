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

  const fillDemoCredentials = (role) => {
    switch (role) {
      case 'superadmin':
        setEmail('superadmin@sibaway.com');
        setPassword('superadmin@sibaway.com');
        break;
      case 'orgadmin':
        setEmail('orgadmin@sibaway.com');
        setPassword('admin123');
        break;
      default:
        break;
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h1>🚀 SibaWay</h1>
        <h2 style={{textAlign: 'center', color: 'var(--navy)'}}>Admin Portal</h2>
        
        {error && <div style={{color: 'var(--danger)', textAlign: 'center', marginBottom: '1rem'}}>{error}</div>}
        
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={loading}
          style={{width: '100%'}}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
        
        <div style={{marginTop: '2rem'}}>
          <h4 style={{textAlign: 'center', marginBottom: '1rem', color: 'var(--navy)'}}>Quick Access:</h4>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
            <button 
              type="button"
              className="btn btn-outline"
              onClick={() => fillDemoCredentials('superadmin')}
            >
              👑 Super Admin
            </button>
            
            <button 
              type="button"
              className="btn btn-outline"
              onClick={() => fillDemoCredentials('orgadmin')}
            >
              💼 Business Owner
            </button>
          </div>
        </div>
        
        {/* REMOVED: Registration link */}
      </form>
    </div>
  );
}

export default Login;