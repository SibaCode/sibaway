import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';

function SuperAdminDashboard() {
  const { userData, logout } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateBusiness, setShowCreateBusiness] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  
  const [businessForm, setBusinessForm] = useState({
    businessName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: 'admin123',
    businessLogo: null,
    logoPreview: null
  });

  useEffect(() => {
    // Define all fetch functions inside useEffect to avoid dependency warnings
    const fetchBusinesses = async () => {
      const querySnapshot = await getDocs(collection(db, 'organizations'));
      const businessesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBusinesses(businessesData);
    };

    const fetchAllClasses = async () => {
      const querySnapshot = await getDocs(collection(db, 'classes'));
      const classesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllClasses(classesData);
    };

    const fetchAllRegistrations = async () => {
      const querySnapshot = await getDocs(collection(db, 'registrations'));
      const registrationsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllRegistrations(registrationsData);
    };

    const fetchAllData = async () => {
      await Promise.all([
        fetchBusinesses(),
        fetchAllClasses(),
        fetchAllRegistrations()
      ]);
    };

    fetchAllData();
  }, []); // Empty dependency array - all functions are defined inside

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  // Individual refresh functions for external use (like refresh buttons)
  const refreshBusinesses = async () => {
    const querySnapshot = await getDocs(collection(db, 'organizations'));
    const businessesData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setBusinesses(businessesData);
  };

  const refreshAllClasses = async () => {
    const querySnapshot = await getDocs(collection(db, 'classes'));
    const classesData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setAllClasses(classesData);
  };

  const refreshAllRegistrations = async () => {
    const querySnapshot = await getDocs(collection(db, 'registrations'));
    const registrationsData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setAllRegistrations(registrationsData);
  };

  // Calculate platform statistics
  const platformStats = {
    totalBusinesses: businesses.length,
    totalClasses: allClasses.length,
    totalRegistrations: allRegistrations.length,
    totalRevenue: allRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0),
    pendingRegistrations: allRegistrations.filter(reg => reg.status === 'pending').length,
    activeClasses: allClasses.filter(cls => cls.status === 'active').length,
    archivedClasses: allClasses.filter(cls => cls.status === 'archived').length,
  };

  // View business dashboard (read-only access)
  const viewBusinessDashboard = (businessId) => {
    const business = businesses.find(b => b.id === businessId);
    showNotification(`Viewing ${business?.name} dashboard`, 'info');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo file size too large. Please select an image under 2MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setBusinessForm({
          ...businessForm,
          businessLogo: file,
          logoPreview: e.target.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const createBusinessAndOwner = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert logo to Base64 if uploaded
      let logoBase64 = '';
      if (businessForm.businessLogo) {
        logoBase64 = await convertToBase64(businessForm.businessLogo);
      }

      // 1. Create business in Firestore
      const businessId = uuidv4();
      
      const businessData = {
        id: businessId,
        name: businessForm.businessName,
        email: businessForm.ownerEmail,
        adminName: businessForm.ownerName,
        logo: logoBase64,
        logoFileName: businessForm.businessLogo?.name || '',
        createdAt: new Date(),
        status: 'active'
      };

      await addDoc(collection(db, 'organizations'), businessData);

      // 2. Create auth user for business owner
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          businessForm.ownerEmail,
          businessForm.ownerPassword
        );
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use') {
          throw new Error('Email already in use. Please use a different email.');
        } else {
          throw authError;
        }
      }

      // 3. Create user document in Firestore
      const userData = {
        name: businessForm.ownerName,
        email: businessForm.ownerEmail,
        role: 'orgAdmin',
        organizationId: businessId,
        organizationName: businessForm.businessName,
        createdAt: new Date()
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);

      // 4. Reset form and refresh data
      setShowCreateBusiness(false);
      setBusinessForm({ 
        businessName: '', 
        ownerName: '', 
        ownerEmail: '', 
        ownerPassword: 'admin123',
        businessLogo: null,
        logoPreview: null
      });
      
      // Refresh data using the refresh functions
      refreshBusinesses();
      
      showNotification(
        `Business created successfully!\n\nOwner credentials:\nEmail: ${businessForm.ownerEmail}\nPassword: ${businessForm.ownerPassword}`,
        'success'
      );
      
    } catch (error) {
      console.error('Error creating business:', error);
      showNotification('Error creating business: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteBusiness = async (businessId, businessName) => {
    if (window.confirm(`Are you sure you want to delete "${businessName}"? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'organizations', businessId));
        refreshBusinesses();
        showNotification('Business deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting business:', error);
        showNotification('Error deleting business', 'error');
      }
    }
  };

  const copyToClipboard = (text, message) => {
    navigator.clipboard.writeText(text);
    showNotification(message, 'success');
  };

  return (
    <div className="dashboard">
      {/* Notification System */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification({ show: false, message: '', type: '' })}>×</button>
        </div>
      )}

      <nav className="navbar">
        <div className="navbar-brand">
          <span>🚀 SibaWay - Super Admin</span>
        </div>
        <div className="navbar-actions">
          <button onClick={logout} className="btn btn-outline btn-sm">
            Logout ({userData?.name})
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        {/* Navigation Tabs */}
        <div className="tabs-container">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📊 Platform Overview
            </button>
            <button 
              className={`tab ${activeTab === 'businesses' ? 'active' : ''}`}
              onClick={() => setActiveTab('businesses')}
            >
              🏢 Businesses ({businesses.length})
            </button>
            <button 
              className={`tab ${activeTab === 'classes' ? 'active' : ''}`}
              onClick={() => setActiveTab('classes')}
            >
              🎓 All Classes ({allClasses.length})
            </button>
            <button 
              className={`tab ${activeTab === 'registrations' ? 'active' : ''}`}
              onClick={() => setActiveTab('registrations')}
            >
              👥 All Registrations ({allRegistrations.length})
            </button>
          </div>
        </div>

        {/* Platform Overview Tab */}
        {activeTab === 'overview' && (
          <section className="section">
            <div className="header-section">
              <h1>Platform Overview</h1>
              <p>Complete visibility across all businesses and classes</p>
              <button 
                onClick={() => setShowCreateBusiness(true)} 
                className="btn btn-primary btn-large"
                disabled={loading}
              >
                ➕ Add New Business
              </button>
            </div>

            {/* Platform Statistics */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🏢</div>
                <div className="stat-content">
                  <div className="stat-number">{platformStats.totalBusinesses}</div>
                  <div className="stat-label">Total Businesses</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎓</div>
                <div className="stat-content">
                  <div className="stat-number">{platformStats.totalClasses}</div>
                  <div className="stat-label">Total Classes</div>
                  <div className="stat-subtext">
                    {platformStats.activeClasses} active • {platformStats.archivedClasses} archived
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <div className="stat-number">{platformStats.totalRegistrations}</div>
                  <div className="stat-label">Total Registrations</div>
                  <div className="stat-subtext">
                    {platformStats.pendingRegistrations} pending approval
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <div className="stat-number">R{platformStats.totalRevenue.toFixed(2)}</div>
                  <div className="stat-label">Total Revenue</div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="recent-activity">
              <h3>Recent Business Activity</h3>
              <div className="activity-grid">
                {businesses.slice(0, 6).map(business => {
                  const businessClasses = allClasses.filter(cls => cls.organizationId === business.id);
                  const businessRegistrations = allRegistrations.filter(reg => reg.organizationId === business.id);
                  
                  return (
                    <div key={business.id} className="activity-card">
                      <div className="activity-header">
                        <h4>{business.name}</h4>
                        <span className="status-badge status-active">Active</span>
                      </div>
                      <div className="activity-stats">
                        <div className="activity-stat">
                          <span className="stat-label">Classes:</span>
                          <span className="stat-value">{businessClasses.length}</span>
                        </div>
                        <div className="activity-stat">
                          <span className="stat-label">Students:</span>
                          <span className="stat-value">{businessRegistrations.length}</span>
                        </div>
                        <div className="activity-stat">
                          <span className="stat-label">Revenue:</span>
                          <span className="stat-value">
                            R{businessRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button 
                        className="btn btn-outline btn-sm"
                        onClick={() => viewBusinessDashboard(business.id)}
                      >
                        View Dashboard
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Businesses Tab */}
        {activeTab === 'businesses' && (
          <section className="section">
            <div className="section-header">
              <h2>All Businesses ({businesses.length})</h2>
              <div className="section-actions">
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={refreshBusinesses}
                >
                  🔄 Refresh
                </button>
                <button 
                  onClick={() => setShowCreateBusiness(true)} 
                  className="btn btn-primary btn-sm"
                >
                  ➕ Add Business
                </button>
              </div>
            </div>
            
            {businesses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏢</div>
                <h3>No businesses yet</h3>
                <p>Create your first business to get started!</p>
              </div>
            ) : (
              <div className="cards-grid">
                {businesses.map(business => {
                  const businessClasses = allClasses.filter(cls => cls.organizationId === business.id);
                  const businessRegistrations = allRegistrations.filter(reg => reg.organizationId === business.id);
                  
                  return (
                    <div key={business.id} className="card">
                      <div className="card-header">
                        <div className="business-card-header">
                          {business.logo ? (
                            <img src={business.logo} alt={`${business.name} logo`} className="business-logo-small" />
                          ) : (
                            <div className="logo-placeholder-small">🏢</div>
                          )}
                          <h3>{business.name}</h3>
                        </div>
                        <span className={`status-badge status-${business.status || 'active'}`}>
                          {business.status || 'active'}
                        </span>
                      </div>
                      
                      <div className="card-content">
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="label">Owner:</span>
                            <span className="value">{business.adminName}</span>
                          </div>
                          <div className="info-item">
                            <span className="label">Email:</span>
                            <span className="value">{business.email}</span>
                          </div>
                          <div className="info-item">
                            <span className="label">Classes:</span>
                            <span className="value">{businessClasses.length}</span>
                          </div>
                          <div className="info-item">
                            <span className="label">Students:</span>
                            <span className="value">{businessRegistrations.length}</span>
                          </div>
                          <div className="info-item">
                            <span className="label">Revenue:</span>
                            <span className="value">
                              R{businessRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="card-actions">
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => viewBusinessDashboard(business.id)}
                        >
                          👁️ View
                        </button>
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => copyToClipboard(business.id, 'Business ID copied!')}
                        >
                          📋 Copy ID
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteBusiness(business.id, business.name)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* All Classes Tab */}
        {activeTab === 'classes' && (
          <section className="section">
            <div className="section-header">
              <h2>All Classes ({allClasses.length})</h2>
              <button 
                className="btn btn-outline btn-sm"
                onClick={refreshAllClasses}
              >
                🔄 Refresh
              </button>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Class Name</th>
                    <th>Business</th>
                    <th>Price</th>
                    <th>Students</th>
                    <th>Status</th>
                    <th>Registration Link</th>
                  </tr>
                </thead>
                <tbody>
                  {allClasses.map(classItem => {
                    const classRegistrations = allRegistrations.filter(reg => reg.classId === classItem.id);
                    const business = businesses.find(b => b.id === classItem.organizationId);
                    
                    return (
                      <tr key={classItem.id}>
                        <td className="class-name">{classItem.name}</td>
                        <td>{business?.name || 'Unknown'}</td>
                        <td>R{classItem.price}</td>
                        <td>{classRegistrations.length}</td>
                        <td>
                          <span className={`status-badge status-${classItem.status || 'active'}`}>
                            {classItem.status || 'active'}
                          </span>
                        </td>
                        <td>
                          {classItem.registrationLink && (
                            <button 
                              className="btn btn-outline btn-xs"
                              onClick={() => copyToClipboard(classItem.registrationLink, 'Registration link copied!')}
                            >
                              📋 Copy Link
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* All Registrations Tab */}
        {activeTab === 'registrations' && (
          <section className="section">
            <div className="section-header">
              <h2>All Registrations ({allRegistrations.length})</h2>
              <button 
                className="btn btn-outline btn-sm"
                onClick={refreshAllRegistrations}
              >
                🔄 Refresh
              </button>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Business</th>
                    <th>Amount Paid</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {allRegistrations.slice(0, 50).map(registration => {
                    const classItem = allClasses.find(cls => cls.id === registration.classId);
                    const business = businesses.find(b => b.id === registration.organizationId);
                    
                    return (
                      <tr key={registration.id}>
                        <td>
                          <div>
                            <div className="student-name">{registration.studentName}</div>
                            <div className="student-email">{registration.studentEmail}</div>
                          </div>
                        </td>
                        <td>{classItem?.name || 'Unknown Class'}</td>
                        <td>{business?.name || 'Unknown Business'}</td>
                        <td>R{registration.amountPaid || 0}</td>
                        <td>
                          <span className={`status-badge status-${registration.status}`}>
                            {registration.status}
                          </span>
                        </td>
                        <td>{registration.paymentDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {allRegistrations.length > 50 && (
                <div className="table-footer">
                  Showing 50 of {allRegistrations.length} registrations
                </div>
              )}
            </div>
          </section>
        )}

        {/* Create Business Modal */}
        {showCreateBusiness && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Create New Business</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowCreateBusiness(false)}
                  disabled={loading}
                >
                  ×
                </button>
              </div>
              <form onSubmit={createBusinessAndOwner}>
                <div className="form-group">
                  <label className="form-label">Business Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Tech Academy Inc."
                    value={businessForm.businessName}
                    onChange={(e) => setBusinessForm({...businessForm, businessName: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Owner Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="John Doe"
                    value={businessForm.ownerName}
                    onChange={(e) => setBusinessForm({...businessForm, ownerName: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Owner Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="owner@business.com"
                    value={businessForm.ownerEmail}
                    onChange={(e) => setBusinessForm({...businessForm, ownerEmail: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Password *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={businessForm.ownerPassword}
                    onChange={(e) => setBusinessForm({...businessForm, ownerPassword: e.target.value})}
                    required
                  />
                  <p className="form-hint">The business owner will use this to log in</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Business Logo (Optional)</label>
                  <div className="logo-upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                    <p className="file-hint">Upload your business logo (Max 2MB, JPG/PNG)</p>
                    
                    {businessForm.logoPreview && (
                      <div className="logo-preview">
                        <p>Logo Preview:</p>
                        <img src={businessForm.logoPreview} alt="Logo preview" />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Create Business & Account'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline"
                    onClick={() => setShowCreateBusiness(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SuperAdminDashboard;