import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import './WelcomePage.css';

const WelcomePage = () => {
  const [platformStats, setPlatformStats] = useState({
    totalBusinesses: 0,
    totalStudents: 0,
    totalRevenue: 0,
    totalClasses: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformStats();
  }, []);

  const fetchPlatformStats = async () => {
    try {
      // Fetch all businesses
      const businessesSnapshot = await getDocs(collection(db, 'organizations'));
      const totalBusinesses = businessesSnapshot.size;

      // Fetch all registrations (students)
      const registrationsSnapshot = await getDocs(collection(db, 'registrations'));
      const approvedRegistrations = registrationsSnapshot.docs.filter(
        doc => doc.data().status === 'approved'
      );
      const totalStudents = approvedRegistrations.length;

      // Calculate total revenue
      const totalRevenue = approvedRegistrations.reduce((sum, doc) => {
        return sum + (doc.data().amountPaid || 0);
      }, 0);

      // Fetch all classes
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const activeClasses = classesSnapshot.docs.filter(
        doc => doc.data().status === 'active'
      );
      const totalClasses = activeClasses.length;

      setPlatformStats({
        totalBusinesses,
        totalStudents,
        totalRevenue,
        totalClasses
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate satisfaction rate based on attendance (you can modify this logic)
  // const calculateSatisfactionRate = () => {
    // For now, we'll use a placeholder calculation
    // In a real scenario, you might calculate this from student feedback or attendance rates
    // return '95%';
  // };

  return (
    <div className="hero-section">
      {/* Hero Content */}
      <div className="hero-content">
        <div className="container">
          <div className="hero-text">
            <span>✨</span>
            <h1 className="hero-title">
              Streamline
              <span className="gradient-text"> Your </span> 
              Business!
            </h1>
            
            <p className="hero-description">
              SibaWay helps super admins and business owners efficiently manage classes, 
              process registrations, track payments and grow their education business.
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
                <div className="stat-number">
                  {loading ? '...' : platformStats.totalBusinesses.toLocaleString()}+
                </div>
                <div className="stat-label">Businesses</div>
              </div>
              <div className="stat">
                <div className="stat-number">
                  {loading ? '...' : platformStats.totalStudents.toLocaleString()}+
                </div>
                <div className="stat-label">Students</div>
              </div>
              {/* <div className="stat">
                <div className="stat-number">
                  {loading ? '...' : calculateSatisfactionRate()}
                </div>
                <div className="stat-label">Satisfaction</div>
              </div> */}
              <div className="stat">
                <div className="stat-number">
                  {loading ? '...' : platformStats.totalClasses.toLocaleString()}+
                </div>
                <div className="stat-label">Active Classes</div>
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
                <div className="preview-title">Live Platform Data</div>
              </div>
              
              <div className="preview-content">
                <div className="preview-cards">
                  <div className="preview-card">
                    <div className="card-icon">🏢</div>
                    <div className="card-content">
                      <div className="card-value">
                        {loading ? '...' : platformStats.totalBusinesses}
                      </div>
                      <div className="card-label">Active Businesses</div>
                    </div>
                  </div>
                  <div className="preview-card">
                    <div className="card-icon">👥</div>
                    <div className="card-content">
                      <div className="card-value">
                        {loading ? '...' : platformStats.totalStudents}
                      </div>
                      <div className="card-label">Total Students</div>
                    </div>
                  </div>
                  <div className="preview-card">
                    <div className="card-icon">💰</div>
                    <div className="card-content">
                      <div className="card-value">
                        {loading ? '...' : `R ${platformStats.totalRevenue.toLocaleString()}`}
                      </div>
                      <div className="card-label">Platform Revenue</div>
                    </div>
                  </div>
                  <div className="preview-card">
                    <div className="card-icon">🎓</div>
                    <div className="card-content">
                      <div className="card-value">
                        {loading ? '...' : platformStats.totalClasses}
                      </div>
                      <div className="card-label">Active Classes</div>
                    </div>
                  </div>
                </div>
                
                {/* Real registration trend chart */}
                <div className="preview-chart">
                  <div className="chart-title">Weekly Registrations</div>
                  <LiveRegistrationChart />
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

// Component for live registration chart
const LiveRegistrationChart = () => {
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeeklyRegistrations();
  }, []);

  const fetchWeeklyRegistrations = async () => {
    try {
      const registrationsSnapshot = await getDocs(collection(db, 'registrations'));
      const registrations = registrationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get last 7 days
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayRegistrations = registrations.filter(reg => 
          reg.paymentDate === dateStr
        ).length;

        last7Days.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          count: dayRegistrations
        });
      }

      setWeeklyData(last7Days);
    } catch (error) {
      console.error('Error fetching weekly data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="chart-loading">
        <div className="loading-bars">
          {[1, 2, 3, 4, 5, 6, 7].map((_, index) => (
            <div key={index} className="loading-bar"></div>
          ))}
        </div>
        <div className="chart-labels">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...weeklyData.map(d => d.count), 1);

  return (
    <>
      <div className="chart-bars">
        {weeklyData.map((day, index) => (
          <div 
            key={index}
            className="chart-bar"
            style={{ 
              height: `${(day.count / maxCount) * 80}%`,
              backgroundColor: day.count > 0 ? '#3b82f6' : '#e5e7eb'
            }}
            title={`${day.count} registrations`}
          ></div>
        ))}
      </div>
      <div className="chart-labels">
        {weeklyData.map((day, index) => (
          <span key={index}>{day.day}</span>
        ))}
      </div>
    </>
  );
};

export default WelcomePage;