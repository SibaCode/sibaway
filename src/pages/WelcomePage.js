import { Link } from 'react-router-dom';
import './WelcomePage.css';

const WelcomePage = () => {

 


  return (
    <div className="hero-section">
  

      {/* Hero Content */}
      <div className="hero-content">
        <div className="container">
          <div className="hero-text">
            <div className="hero-badge">
              <span>✨</span>
              Streamline Your Business Education
            </div>
            
            <h1 className="hero-title">
              Manage Classes, Students & 
              <span className="gradient-text"> Payments</span> 
              in One Platform
            </h1>
            
            <p className="hero-description">
              SibaWay helps super admins and business owners efficiently manage classes, 
              process registrations, track payments, and grow their education business.
            </p>

            <div className="hero-buttons">
              <Link to="/login" className="btn btn-primary">
                <span className="btn-icon">🚀</span>
                Access Dashboard
              </Link>
              <button className="btn btn-secondary">
                <span className="btn-icon">▶</span>
                Watch Demo
              </button>
            </div>

            <div className="hero-stats">
              <div className="stat">
                <div className="stat-number">500+</div>
                <div className="stat-label">Businesses</div>
              </div>
              <div className="stat">
                <div className="stat-number">50K+</div>
                <div className="stat-label">Students</div>
              </div>
              <div className="stat">
                <div className="stat-number">98%</div>
                <div className="stat-label">Satisfaction</div>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="dashboard-preview">
              <div className="preview-header">
                <div className="preview-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className="preview-title">Business Dashboard</div>
              </div>
              
              <div className="preview-content">
                <div className="preview-cards">
                  <div className="preview-card">
                    <div className="card-icon">👥</div>
                    <div className="card-content">
                      <div className="card-value">245</div>
                      <div className="card-label">Active Students</div>
                    </div>
                  </div>
                  <div className="preview-card">
                    <div className="card-icon">💰</div>
                    <div className="card-content">
                      <div className="card-value">R 45,230</div>
                      <div className="card-label">Total Revenue</div>
                    </div>
                  </div>
                </div>
                
                <div className="preview-chart">
                  <div className="chart-bars">
                    {[60, 80, 45, 90, 70, 85].map((height, index) => (
                      <div 
                        key={index}
                        className="chart-bar"
                        style={{ height: `${height}%` }}
                      ></div>
                    ))}
                  </div>
                  <div className="chart-labels">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Elements */}
      <div className="hero-background">
        <div className="bg-shape shape-1"></div>
        <div className="bg-shape shape-2"></div>
        <div className="bg-shape shape-3"></div>
      </div>
    </div>
  );
};

export default WelcomePage;