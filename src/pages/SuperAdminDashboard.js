import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';

function SuperAdminDashboard() {
  const { userData, logout } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [users, setUsers] = useState([]);
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
    fetchBusinesses();
    fetchUsers();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  const fetchBusinesses = async () => {
    const querySnapshot = await getDocs(collection(db, 'organizations'));
    const businessesData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setBusinesses(businessesData);
  };

  const fetchUsers = async () => {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const usersData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setUsers(usersData);
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
      
      fetchBusinesses();
      fetchUsers();
      
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
        fetchBusinesses();
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
        <div className="header-section">
          <h1>Business Management</h1>
          <p>Manage all businesses and owners on the platform</p>
          <button 
            onClick={() => setShowCreateBusiness(true)} 
            className="btn btn-primary btn-large"
            disabled={loading}
          >
            ➕ Add New Business
          </button>
        </div>

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

        <section className="section">
          <div className="section-header">
            <h2>Businesses ({businesses.length})</h2>
            <button 
              className="btn btn-outline btn-sm"
              onClick={fetchBusinesses}
            >
              🔄 Refresh
            </button>
          </div>
          
          {businesses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏢</div>
              <h3>No businesses yet</h3>
              <p>Create your first business to get started!</p>
            </div>
          ) : (
            <div className="cards-grid">
              {businesses.map(business => (
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
                    <div className="info-item">
                      <span className="label">Owner:</span>
                      <span className="value">{business.adminName}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Email:</span>
                      <span className="value">{business.email}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Created:</span>
                      <span className="value">{business.createdAt?.toDate().toLocaleDateString()}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">ID:</span>
                      <span className="value code">{business.id}</span>
                    </div>
                  </div>
                  
                  <div className="card-actions">
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
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-header">
            <h2>Business Owners ({users.filter(user => user.role === 'orgAdmin').length})</h2>
          </div>
          
          <div className="cards-grid">
            {users.filter(user => user.role === 'orgAdmin').map(user => (
              <div key={user.id} className="card">
                <div className="card-header">
                  <h3>{user.name}</h3>
                  <span className={`status-badge status-${user.organizationId ? 'active' : 'inactive'}`}>
                    {user.organizationId ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="card-content">
                  <div className="info-item">
                    <span className="label">Email:</span>
                    <span className="value">{user.email}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Business ID:</span>
                    <span className="value code">{user.organizationId}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Joined:</span>
                    <span className="value">{user.createdAt?.toDate().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
            
            {users.filter(user => user.role === 'orgAdmin').length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">👤</div>
                <h3>No business owners</h3>
                <p>Business owners will appear here when you create businesses</p>
              </div>
            )}
          </div>
        </section>

        <section className="section">
          <h2>Platform Overview</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🏢</div>
              <div className="stat-content">
                <div className="stat-number">{businesses.length}</div>
                <div className="stat-label">Total Businesses</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👤</div>
              <div className="stat-content">
                <div className="stat-number">{users.filter(user => user.role === 'orgAdmin').length}</div>
                <div className="stat-label">Business Owners</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-number">{users.length}</div>
                <div className="stat-label">Total Users</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default SuperAdminDashboard;