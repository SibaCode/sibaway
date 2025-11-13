import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  updateDoc,
  doc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';

function OrgAdminDashboard() {
  const { userData, logout } = useAuth();
  const [classes, setClasses] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [approvedRegistrations, setApprovedRegistrations] = useState([]);
  const [activeTab, setActiveTab] = useState('classes');
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showEditClass, setShowEditClass] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // Form states
  const [classForm, setClassForm] = useState({
    name: '',
    description: '',
    price: '',
    paymentInstructions: '',
    capacity: '',
    schedule: '',
    startDate: '',
    endDate: '',
    venue: ''
  });

  const [editingClass, setEditingClass] = useState(null);

  // Debug userData
  useEffect(() => {
    console.log('User Data:', userData);
    console.log('Organization Name:', userData?.organizationName);
    console.log('Organization ID:', userData?.organizationId);
  }, [userData]);

  // Memoized fetch functions to prevent dependency issues
  const fetchClasses = useCallback(async () => {
    if (!userData?.organizationId) return;
    
    const q = query(
      collection(db, 'classes'),
      where('organizationId', '==', userData.organizationId)
    );
    const querySnapshot = await getDocs(q);
    const classesData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setClasses(classesData);
  }, [userData?.organizationId]);

  const fetchRegistrations = useCallback(async () => {
    if (!userData?.organizationId) return;
    
    // Fetch pending registrations
    const pendingQ = query(
      collection(db, 'registrations'),
      where('organizationId', '==', userData.organizationId),
      where('status', '==', 'pending')
    );
    
    const approvedQ = query(
      collection(db, 'registrations'),
      where('organizationId', '==', userData.organizationId),
      where('status', '==', 'approved')
    );

    const [pendingSnapshot, approvedSnapshot] = await Promise.all([
      getDocs(pendingQ),
      getDocs(approvedQ)
    ]);

    const pendingData = await Promise.all(
      pendingSnapshot.docs.map(async (regDoc) => {
        const regData = regDoc.data();
        const classDoc = await getDoc(doc(db, 'classes', regData.classId));
        
        let className = 'Class Not Found';
        if (classDoc.exists()) {
          const classData = classDoc.data();
          // Use the URL format: /{courseSlug}/{venueSlug}/{dateSlug}
          className = `/${classData.courseSlug}/${classData.venueSlug}/${classData.dateSlug}`;
        }
        
        return {
          id: regDoc.id,
          ...regData,
          class: { name: className }
        };
      })
    );

    const approvedData = await Promise.all(
      approvedSnapshot.docs.map(async (regDoc) => {
        const regData = regDoc.data();
        const classDoc = await getDoc(doc(db, 'classes', regData.classId));
        
        let className = 'Class Not Found';
        if (classDoc.exists()) {
          const classData = classDoc.data();
          // Use the URL format: /{courseSlug}/{venueSlug}/{dateSlug}
          className = `/${classData.courseSlug}/${classData.venueSlug}/${classData.dateSlug}`;
        }
        
        return {
          id: regDoc.id,
          ...regData,
          class: { name: className }
        };
      })
    );
    
    setPendingRegistrations(pendingData);
    setApprovedRegistrations(approvedData);
  }, [userData?.organizationId]);

  // Load data when organizationId is available
  useEffect(() => {
    if (userData?.organizationId) {
      fetchClasses();
      fetchRegistrations();
    }
  }, [userData?.organizationId, fetchClasses, fetchRegistrations]);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  // Class Management Functions - FIXED VERSION
  const createClass = async (e) => {
    e.preventDefault();
    
    try {
      // Validate required fields
      if (!classForm.name || !classForm.price || !classForm.venue || !classForm.paymentInstructions) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }

      // Validate user data
      if (!userData?.organizationId) {
        showNotification('User organization data is missing. Please log out and log in again.', 'error');
        return;
      }

      // Generate URL-friendly slugs with better null handling
      const generateSlug = (text) => {
        if (!text || text.trim() === '') return 'business';
        return text
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
          .substring(0, 30);
      };

      // Get business name with multiple fallbacks
      const getBusinessName = () => {
        return userData?.organizationName || userData?.name || 'My Business';
      };

      const businessName = getBusinessName();
      const businessSlug = generateSlug(businessName);
      
      // Generate course slug
      let courseSlug = generateSlug(classForm.name);
      let finalCourseSlug = courseSlug;
      let counter = 1;

      // Check for slug collisions
      const existingClassesQuery = query(
        collection(db, 'classes'),
        where('organizationId', '==', userData.organizationId)
      );
      const existingClassesSnapshot = await getDocs(existingClassesQuery);
      const existingSlugs = existingClassesSnapshot.docs.map(doc => doc.data().courseSlug).filter(Boolean);
      
      while (existingSlugs.includes(finalCourseSlug)) {
        finalCourseSlug = `${courseSlug}-${counter}`;
        counter++;
      }

      // Generate venue slug
      const venueSlug = generateSlug(classForm.venue || 'online');
      
      // Generate date slug (use start date or current date)
      const dateSlug = classForm.startDate 
        ? classForm.startDate.replace(/-/g, '')
        : new Date().toISOString().split('T')[0].replace(/-/g, '');

      const classId = uuidv4();
      const registrationLink = `${window.location.origin}/${businessSlug}/${finalCourseSlug}/${venueSlug}/${dateSlug}`;
      
      // Create class data with proper fallbacks
      const classData = {
        name: classForm.name,
        description: classForm.description,
        price: parseFloat(classForm.price),
        paymentInstructions: classForm.paymentInstructions,
        capacity: classForm.capacity ? parseInt(classForm.capacity) : null,
        schedule: classForm.schedule || '',
        startDate: classForm.startDate || '',
        endDate: classForm.endDate || '',
        venue: classForm.venue,
        id: classId,
        businessSlug: businessSlug,
        courseSlug: finalCourseSlug,
        venueSlug: venueSlug,
        dateSlug: dateSlug,
        organizationId: userData.organizationId,
        organizationName: businessName,
        registrationLink,
        createdAt: new Date(),
        status: 'active',
        enrolledCount: 0
      };

      console.log('Creating class with data:', classData);
      
      await addDoc(collection(db, 'classes'), classData);
      
      setShowCreateClass(false);
      setClassForm({ 
        name: '', 
        description: '', 
        price: '', 
        paymentInstructions: '',
        capacity: '',
        schedule: '',
        startDate: '',
        endDate: '',
        venue: ''
      });
      fetchClasses();
      showNotification('Class created successfully!');
    } catch (error) {
      console.error('Error creating class:', error);
      showNotification('Error creating class: ' + error.message, 'error');
    }
  };

  const editClass = (classItem) => {
    setEditingClass(classItem);
    setClassForm({
      name: classItem.name,
      description: classItem.description,
      price: classItem.price.toString(),
      paymentInstructions: classItem.paymentInstructions,
      capacity: classItem.capacity?.toString() || '',
      schedule: classItem.schedule || '',
      startDate: classItem.startDate || '',
      endDate: classItem.endDate || '',
      venue: classItem.venue || ''
    });
    setShowEditClass(true);
  };

  const updateClass = async (e) => {
    e.preventDefault();
    
    try {
      await updateDoc(doc(db, 'classes', editingClass.id), {
        ...classForm,
        price: parseFloat(classForm.price),
        capacity: classForm.capacity ? parseInt(classForm.capacity) : null,
        updatedAt: new Date()
      });
      
      setShowEditClass(false);
      setEditingClass(null);
      setClassForm({ 
        name: '', 
        description: '', 
        price: '', 
        paymentInstructions: '',
        capacity: '',
        schedule: '',
        startDate: '',
        endDate: '',
        venue: ''
      });
      fetchClasses();
      showNotification('Class updated successfully!');
    } catch (error) {
      console.error('Error updating class:', error);
      showNotification('Error updating class', 'error');
    }
  };

  const duplicateClass = async (classItem) => {
    try {
      // Generate URL-friendly slugs with better null handling
      const generateSlug = (text) => {
        if (!text || text.trim() === '') return 'business';
        return text
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
          .substring(0, 30);
      };

      // Get business name with multiple fallbacks
      const getBusinessName = () => {
        return userData?.organizationName || userData?.name || 'My Business';
      };

      const businessName = getBusinessName();
      const businessSlug = generateSlug(businessName);

      let baseSlug = generateSlug(`${classItem.name}-copy`);
      let finalSlug = baseSlug;
      let counter = 1;

      const existingClassesQuery = query(
        collection(db, 'classes'),
        where('organizationId', '==', userData.organizationId)
      );
      const existingClassesSnapshot = await getDocs(existingClassesQuery);
      const existingSlugs = existingClassesSnapshot.docs.map(doc => doc.data().courseSlug).filter(Boolean);
      
      while (existingSlugs.includes(finalSlug)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      const venueSlug = generateSlug(classItem.venue || 'online');
      const dateSlug = classItem.startDate 
        ? classItem.startDate.replace(/-/g, '')
        : new Date().toISOString().split('T')[0].replace(/-/g, '');

      const newClassId = uuidv4();
      const registrationLink = `${window.location.origin}/${businessSlug}/${finalSlug}/${venueSlug}/${dateSlug}`;
      
      await addDoc(collection(db, 'classes'), {
        ...classItem,
        id: newClassId,
        businessSlug: businessSlug,
        courseSlug: finalSlug,
        venueSlug: venueSlug,
        dateSlug: dateSlug,
        organizationId: userData.organizationId,
        organizationName: businessName,
        registrationLink,
        createdAt: new Date(),
        name: `${classItem.name} (Copy)`,
        enrolledCount: 0,
        status: 'active'
      });
      
      fetchClasses();
      showNotification('Class duplicated successfully!');
    } catch (error) {
      console.error('Error duplicating class:', error);
      showNotification('Error duplicating class', 'error');
    }
  };

  const archiveClass = async (classId, className) => {
    if (window.confirm(`Archive "${className}"? Students can no longer register.`)) {
      try {
        await updateDoc(doc(db, 'classes', classId), {
          status: 'archived',
          updatedAt: new Date()
        });
        fetchClasses();
        showNotification('Class archived successfully');
      } catch (error) {
        console.error('Error archiving class:', error);
        showNotification('Error archiving class', 'error');
      }
    }
  };

  const deleteClass = async (classId, className) => {
    if (window.confirm(`Permanently delete "${className}"? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'classes', classId));
        fetchClasses();
        showNotification('Class deleted successfully');
      } catch (error) {
        console.error('Error deleting class:', error);
        showNotification('Error deleting class', 'error');
      }
    }
  };

  // Registration Management
  const handleApproveRegistration = async (registrationId) => {
    try {
      await updateDoc(doc(db, 'registrations', registrationId), {
        status: 'approved',
        approvedAt: new Date()
      });
      fetchRegistrations();
      showNotification('Registration approved!');
    } catch (error) {
      console.error('Error approving registration:', error);
      showNotification('Error approving registration', 'error');
    }
  };

  const handleRejectRegistration = async (registrationId) => {
    try {
      await updateDoc(doc(db, 'registrations', registrationId), {
        status: 'rejected',
        rejectedAt: new Date()
      });
      fetchRegistrations();
      showNotification('Registration rejected.');
    } catch (error) {
      console.error('Error rejecting registration:', error);
      showNotification('Error rejecting registration', 'error');
    }
  };

  const handleViewPop = (popBase64, fileName) => {
    if (popBase64) {
      const newWindow = window.open();
      newWindow.document.write(`
        <html>
          <head><title>Proof of Payment - ${fileName}</title></head>
          <body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5;">
            <img src="${popBase64}" alt="Proof of Payment" style="max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);" />
          </body>
        </html>
      `);
    }
  };

  const copyToClipboard = (text, message) => {
    navigator.clipboard.writeText(text);
    showNotification(message);
  };

  // Analytics Calculations
  const totalRevenue = approvedRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0);
  const pendingRevenue = pendingRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0);
  const totalStudents = approvedRegistrations.length;

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
          <span>🚀 SibaWay Business</span>
        </div>
        <div className="navbar-actions">
          <button onClick={logout} className="btn btn-outline btn-sm">
            Logout ({userData?.name || 'User'})
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        {/* Analytics Overview */}
        <section className="analytics-section">
          <h2>Business Overview</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🏢</div>
              <div className="stat-content">
                <div className="stat-number">{classes.length}</div>
                <div className="stat-label">Total Classes</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-number">{totalStudents}</div>
                <div className="stat-label">Total Students</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-content">
                <div className="stat-number">R{totalRevenue.toFixed(2)}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-content">
                <div className="stat-number">{pendingRegistrations.length}</div>
                <div className="stat-label">Pending Approvals</div>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="tabs-container">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'classes' ? 'active' : ''}`}
              onClick={() => setActiveTab('classes')}
            >
              🏢 My Classes ({classes.length})
            </button>
            <button 
              className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              ⏳ Pending ({pendingRegistrations.length})
            </button>
            <button 
              className={`tab ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              👥 Students ({approvedRegistrations.length})
            </button>
            <button 
              className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              📊 Reports
            </button>
          </div>
        </div>

        {/* Classes Tab */}
        {activeTab === 'classes' && (
          <section className="section">
            <div className="section-header">
              <h2>My Classes</h2>
              <button 
                onClick={() => setShowCreateClass(true)} 
                className="btn btn-primary"
              >
                ➕ Create New Class
              </button>
            </div>

            {classes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏢</div>
                <h3>No classes yet</h3>
                <p>Create your first class to start accepting registrations!</p>
                <button 
                  onClick={() => setShowCreateClass(true)} 
                  className="btn btn-primary"
                >
                  Create Your First Class
                </button>
              </div>
            ) : (
              <div className="cards-grid">
                {classes.map(classItem => (
                  <div key={classItem.id} className="card">
                    <div className="card-header">
                      <h3>{classItem.name}</h3>
                      <span className={`status-badge status-${classItem.status || 'active'}`}>
                        {classItem.status || 'active'}
                      </span>
                    </div>
                    
                    <div className="card-content">
                      <p>{classItem.description}</p>
                      
                      <div className="info-grid">
                        <div className="info-item">
                          <span className="label">Price:</span>
                          <span className="value">R{classItem.price}</span>
                        </div>
                        {classItem.capacity && (
                          <div className="info-item">
                            <span className="label">Capacity:</span>
                            <span className="value">{classItem.capacity} students</span>
                          </div>
                        )}
                        {classItem.schedule && (
                          <div className="info-item">
                            <span className="label">Schedule:</span>
                            <span className="value">{classItem.schedule}</span>
                          </div>
                        )}
                        <div className="info-item">
                          <span className="label">Enrolled:</span>
                          <span className="value">{classItem.enrolledCount || 0} students</span>
                        </div>
                        {classItem.registrationLink && (
                          <div className="info-item">
                            <span className="label">Registration Link:</span>
                            <span className="value code" style={{fontSize: '0.7rem'}}>
                              {classItem.registrationLink.substring(0, 40)}...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="card-actions">
                      <button 
                        className="btn btn-outline btn-sm"
                        onClick={() => copyToClipboard(classItem.registrationLink, 'Registration link copied!')}
                      >
                        📋 Copy Link
                      </button>
                      <button 
                        className="btn btn-outline btn-sm"
                        onClick={() => editClass(classItem)}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        className="btn btn-outline btn-sm"
                        onClick={() => duplicateClass(classItem)}
                      >
                        📄 Duplicate
                      </button>
                      {classItem.status === 'active' ? (
                        <button 
                          className="btn btn-warning btn-sm"
                          onClick={() => archiveClass(classItem.id, classItem.name)}
                        >
                          📁 Archive
                        </button>
                      ) : (
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteClass(classItem.id, classItem.name)}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Pending Registrations Tab */}
        {activeTab === 'pending' && (
          <section className="section">
            <div className="section-header">
              <h2>Pending Registrations ({pendingRegistrations.length})</h2>
              <div className="revenue-badge">
                Pending Revenue: R{pendingRevenue.toFixed(2)}
              </div>
            </div>

            {pendingRegistrations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <h3>No pending registrations</h3>
                <p>All registrations have been processed.</p>
              </div>
            ) : (
              // <div className="registrations-list">
                <div className="cards-grid">

                {pendingRegistrations.map(reg => (
                  <div key={reg.id} className="card">
                    <div className="card-header">
                      <h3>{reg.studentName}</h3>
                      <span className="status-badge status-pending">Pending Review</span>
                    </div>
                    
                    <div className="card-content">
                      <div className="info-grid">
                        <div className="info-item">
                          <span className="label">Email:</span>
                          <span className="value">{reg.studentEmail}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Phone:</span>
                          <span className="value">{reg.studentPhone}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Class:</span>
                          <span className="value">{reg.class?.name}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Amount Paid:</span>
                          <span className="value">R{reg.amountPaid}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Payment Date:</span>
                          <span className="value">{reg.paymentDate}</span>
                        </div>
                        {reg.transactionId && (
                          <div className="info-item">
                            <span className="label">Transaction ID:</span>
                            <span className="value code">{reg.transactionId}</span>
                          </div>
                        )}
                      </div>
                      
                      {reg.popBase64 && (
                        <div className="pop-section">
                          <button 
                            onClick={() => handleViewPop(reg.popBase64, reg.popFileName)}
                            className="btn btn-outline btn-sm"
                          >
                            📎 View Proof of Payment
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="card-actions">
                      <button 
                        onClick={() => handleApproveRegistration(reg.id)}
                        className="btn btn-success"
                      >
                        ✅ Approve
                      </button>
                      <button 
                        onClick={() => handleRejectRegistration(reg.id)}
                        className="btn btn-danger"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <section className="section">
            <div className="section-header">
              <h2>Approved Students ({approvedRegistrations.length})</h2>
              <div className="revenue-badge">
                Total Revenue: R{totalRevenue.toFixed(2)}
              </div>
            </div>

            {approvedRegistrations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>No approved students yet</h3>
                <p>Students will appear here after you approve their registrations.</p>
              </div>
            ) : (
              // <div className="students-list">
                <div className="cards-grid">

                {approvedRegistrations.map(reg => (
                  <div key={reg.id} className="card">
                    <div className="card-header">
                      <h3>{reg.studentName}</h3>
                      <span className="status-badge status-approved">Approved</span>
                    </div>
                    
                    <div className="card-content">
                      <div className="info-grid">
                        <div className="info-item">
                          <span className="label">Email:</span>
                          <span className="value">{reg.studentEmail}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Phone:</span>
                          <span className="value">{reg.studentPhone}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Class:</span>
                          <span className="value">{reg.class?.name}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Amount Paid:</span>
                          <span className="value">R{reg.amountPaid}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Approved On:</span>
                          <span className="value">{reg.approvedAt?.toDate().toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="card-actions">
                      <button className="btn btn-outline btn-sm">
                        📧 Email Student
                      </button>
                      <button className="btn btn-outline btn-sm">
                        📄 Export Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <section className="section">
            <h2>Business Reports</h2>
            <div className="reports-grid">
              <div className="report-card">
                <h3>📈 Registration Trends</h3>
                <p>View registration patterns over time</p>
                <button className="btn btn-outline">View Report</button>
              </div>
              <div className="report-card">
                <h3>💰 Revenue Analysis</h3>
                <p>Track income and payment trends</p>
                <button className="btn btn-outline">View Report</button>
              </div>
              <div className="report-card">
                <h3>🎓 Class Performance</h3>
                <p>See which classes are most popular</p>
                <button className="btn btn-outline">View Report</button>
              </div>
              <div className="report-card">
                <h3>📊 Student Analytics</h3>
                <p>Understand your student demographics</p>
                <button className="btn btn-outline">View Report</button>
              </div>
            </div>
          </section>
        )}

        {/* Create/Edit Class Modal */}
        {(showCreateClass || showEditClass) && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>{showEditClass ? 'Edit Class' : 'Create New Class'}</h2>
                <button 
                  className="close-btn"
                  onClick={() => {
                    setShowCreateClass(false);
                    setShowEditClass(false);
                    setEditingClass(null);
                    setClassForm({ 
                      name: '', 
                      description: '', 
                      price: '', 
                      paymentInstructions: '',
                      capacity: '',
                      schedule: '',
                      startDate: '',
                      endDate: '',
                      venue: ''
                    });
                  }}
                >
                  ×
                </button>
              </div>
              <form onSubmit={showEditClass ? updateClass : createClass}>
                <div className="form-group">
                  <label className="form-label">Class Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Web Development Bootcamp"
                    value={classForm.name}
                    onChange={(e) => setClassForm({...classForm, name: e.target.value})}
                    required
                  />
                  <p className="form-hint">This will be used to generate a clean URL</p>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea
                    className="form-control"
                    placeholder="Describe what students will learn..."
                    value={classForm.description}
                    onChange={(e) => setClassForm({...classForm, description: e.target.value})}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Price (R) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="0.00"
                      value={classForm.price}
                      onChange={(e) => setClassForm({...classForm, price: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Capacity (Optional)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Unlimited"
                      value={classForm.capacity}
                      onChange={(e) => setClassForm({...classForm, capacity: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date (Optional)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={classForm.startDate}
                      onChange={(e) => setClassForm({...classForm, startDate: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date (Optional)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={classForm.endDate}
                      onChange={(e) => setClassForm({...classForm, endDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Schedule (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Mon-Wed-Fri, 6-8 PM"
                    value={classForm.schedule}
                    onChange={(e) => setClassForm({...classForm, schedule: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Venue/Location *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Lagos Main Campus, Online, Abuja Center"
                    value={classForm.venue}
                    onChange={(e) => setClassForm({...classForm, venue: e.target.value})}
                    required
                  />
                  <p className="form-hint">This will be used in the registration URL</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Instructions *</label>
                  <textarea
                    className="form-control"
                    placeholder="e.g., Send payment via PayPal to your-email@example.com"
                    value={classForm.paymentInstructions}
                    onChange={(e) => setClassForm({...classForm, paymentInstructions: e.target.value})}
                    required
                  />
                  <p className="form-hint">These instructions will be shown to students during registration</p>
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    {showEditClass ? 'Update Class' : 'Create Class'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline"
                    onClick={() => {
                      setShowCreateClass(false);
                      setShowEditClass(false);
                      setEditingClass(null);
                    }}
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

export default OrgAdminDashboard;