import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './css/WelcomePage.css';

const WelcomePage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: '🛡️',
      title: 'Super Admin Control',
      description: 'Manage multiple businesses, create accounts, and oversee platform operations from a centralized dashboard.'
    },
    {
      icon: '🏢',
      title: 'Business Management',
      description: 'Create and manage classes, track registrations, and monitor revenue with intuitive business tools.'
    },
    {
      icon: '👨‍🎓',
      title: 'Student Registration',
      description: 'Streamlined registration process with payment verification and automated confirmation.'
    },
    {
      icon: '📊',
      title: 'Analytics & Reports',
      description: 'Gain insights with comprehensive analytics on enrollment, revenue, and business performance.'
    }
  ];

  const dashboardCards = [
    {
      icon: '🛡️',
      title: 'Super Admin',
      description: 'Platform management and business oversight',
      features: [
        'Manage all businesses',
        'Create business accounts',
        'Monitor platform activity',
        'Generate system reports'
      ],
      buttonText: 'Access Super Admin Dashboard',
      link: '/super-admin-login',
      color: '#0074D9'
    },
    {
      icon: '👔',
      title: 'Business Owner',
      description: 'Class management and student registration',
      features: [
        'Create and manage classes',
        'Process registrations',
        'Track payments and revenue',
        'Communicate with students'
      ],
      buttonText: 'Access Business Dashboard',
      link: '/org-admin-login',
      color: '#28a745'
    },
    {
      icon: '👨‍🎓',
      title: 'Student Registration',
      description: 'Register for classes and submit payments',
      features: [
        'Browse available classes',
        'Simple registration process',
        'Secure payment submission',
        'Registration confirmation'
      ],
      buttonText: 'Get Registration Link',
      link: '#',
      color: '#6f42c1'
    }
  ];

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  return (
    <div className="welcome-page">
      {/* Header */}
      <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container">
          <nav className="navbar">
            <Link to="/" className="logo">
              <span className="logo-icon">🚀</span>
              <span className="logo-text">Siba<span>Way</span></span>
            </Link>
            
            <div className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
              <button 
                className="nav-link" 
                onClick={() => scrollToSection('home')}
              >
                Home
              </button>
              <button 
                className="nav-link" 
                onClick={() => scrollToSection('features')}
              >
                Features
              </button>
              <button 
                className="nav-link" 
                onClick={() => scrollToSection('dashboards')}
              >
                Dashboards
              </button>
              <Link to="/contact" className="nav-link">Contact</Link>
            </div>

            <button className="mobile-menu-btn" onClick={toggleMenu}>
              <span className={`menu-icon ${isMenuOpen ? 'active' : ''}`}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero" id="home">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Streamline Your <span>Business Education</span> Management
            </h1>
            <p className="hero-subtitle">
              SibaWay provides powerful tools for super admins and business owners to manage classes, 
              registrations, and student data all in one place.
            </p>
            <div className="hero-buttons">
              <button 
                className="btn btn-primary"
                onClick={() => scrollToSection('dashboards')}
              >
                <span className="btn-icon">🚀</span>
                Get Started
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => scrollToSection('features')}
              >
                <span className="btn-icon">📹</span>
                Watch Demo
              </button>
            </div>
          </div>
          <div className="hero-image">
            <div className="dashboard-preview">
              <div className="preview-header">
                <div className="preview-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="preview-content">
                <div className="preview-chart">
                  <div className="chart-bar" style={{ height: '60%' }}></div>
                  <div className="chart-bar" style={{ height: '80%' }}></div>
                  <div className="chart-bar" style={{ height: '45%' }}></div>
                  <div className="chart-bar" style={{ height: '90%' }}></div>
                  <div className="chart-bar" style={{ height: '70%' }}></div>
                </div>
                <div className="preview-stats">
                  <div className="stat-item">
                    <span className="stat-number">245</span>
                    <span className="stat-label">Students</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">12</span>
                    <span className="stat-label">Classes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features">
        <div className="container">
          <h2 className="section-title">Powerful Features</h2>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Cards */}
      <section className="dashboard-cards" id="dashboards">
        <div className="container">
          <h2 className="section-title">Access Your Dashboard</h2>
          <div className="cards-container">
            {dashboardCards.map((card, index) => (
              <div key={index} className="dashboard-card">
                <div 
                  className="card-header"
                  style={{ backgroundColor: card.color }}
                >
                  <div className="card-icon">{card.icon}</div>
                  <h3 className="card-title">{card.title}</h3>
                  <p className="card-description">{card.description}</p>
                </div>
                <div className="card-body">
                  <ul className="card-features">
                    {card.features.map((feature, featureIndex) => (
                      <li key={featureIndex}>
                        <span className="check-icon">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card-footer">
                  <Link 
                    to={card.link} 
                    className="btn btn-primary"
                    style={{ 
                      backgroundColor: card.color,
                      width: '100%'
                    }}
                  >
                    <span className="btn-icon">🔑</span>
                    {card.buttonText}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-col">
              <div className="footer-logo">
                <span className="logo-icon">🚀</span>
                Siba<span>Way</span>
              </div>
              <p className="footer-description">
                Streamlining business education management with powerful tools for administrators, 
                business owners, and students.
              </p>
            </div>
            <div className="footer-col">
              <h4 className="footer-heading">Quick Links</h4>
              <ul className="footer-links">
                <li><button onClick={() => scrollToSection('home')}>Home</button></li>
                <li><button onClick={() => scrollToSection('features')}>Features</button></li>
                <li><button onClick={() => scrollToSection('dashboards')}>Dashboards</button></li>
                <li><Link to="/pricing">Pricing</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4 className="footer-heading">Support</h4>
              <ul className="footer-links">
                <li><Link to="/help">Help Center</Link></li>
                <li><Link to="/contact">Contact Us</Link></li>
                <li><Link to="/docs">Documentation</Link></li>
                <li><Link to="/status">Status</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4 className="footer-heading">Contact</h4>
              <ul className="footer-links">
                <li>📧 support@sibaway.com</li>
                <li>📞 +1 (555) 123-4567</li>
                <li>📍 123 Business Ave, Suite 100</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2023 SibaWay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WelcomePage;