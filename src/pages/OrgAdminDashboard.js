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
import './css/OrgAdminDashboard.css';


function OrgAdminDashboard() {
  const { userData, logout } = useAuth();
  const [classes, setClasses] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [approvedRegistrations, setApprovedRegistrations] = useState([]);
  const [activeTab, setActiveTab] = useState('classes');
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showEditClass, setShowEditClass] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [showStudentReviewModal, setShowStudentReviewModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  // const [exportingPDF, setExportingPDF] = useState(false);

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

  // Memoized fetch functions
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
    
    // Fetch all registrations
    const registrationsQ = query(
      collection(db, 'registrations'),
      where('organizationId', '==', userData.organizationId)
    );
    
    const snapshot = await getDocs(registrationsQ);
    
    const allRegistrations = await Promise.all(
      snapshot.docs.map(async (regDoc) => {
        const regData = regDoc.data();
        let classData = {};
        
        if (regData.classId) {
          try {
            const classDoc = await getDoc(doc(db, 'classes', regData.classId));
            if (classDoc.exists()) {
              classData = classDoc.data();
            }
          } catch (error) {
            console.error('Error fetching class data:', error);
          }
        }
        
        return {
          id: regDoc.id,
          ...regData,
          class: classData,
          classId: regData.classId
        };
      })
    );
    
    const pending = allRegistrations.filter(reg => reg.status === 'pending');
    const approved = allRegistrations.filter(reg => reg.status === 'approved');
    
    setPendingRegistrations(pending);
    setApprovedRegistrations(approved);
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

  // Class Management Functions
  const createClass = async (e) => {
    e.preventDefault();
    
    try {
      // Validate required fields
      if (!classForm.name || !classForm.price || !classForm.venue || !classForm.paymentInstructions) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }

      if (!userData?.organizationId) {
        showNotification('User organization data is missing. Please log out and log in again.', 'error');
        return;
      }

      const generateSlug = (text) => {
        if (!text || text.trim() === '') return 'business';
        return text
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
          .substring(0, 30);
      };

      const getBusinessName = () => {
        return userData?.organizationName || userData?.name || 'My Business';
      };

      const businessName = getBusinessName();
      const businessSlug = generateSlug(businessName);
      
      let courseSlug = generateSlug(classForm.name);
      let finalCourseSlug = courseSlug;
      let counter = 1;

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

      const venueSlug = generateSlug(classForm.venue || 'online');
      const dateSlug = classForm.startDate 
        ? classForm.startDate.replace(/-/g, '')
        : new Date().toISOString().split('T')[0].replace(/-/g, '');

      const classId = uuidv4();
      const registrationLink = `${window.location.origin}/${businessSlug}/${finalCourseSlug}/${venueSlug}/${dateSlug}`;
      
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
      const generateSlug = (text) => {
        if (!text || text.trim() === '') return 'business';
        return text
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
          .substring(0, 30);
      };

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

  // Student Management Functions
  const handleViewStudentDetails = (student) => {
    setSelectedStudent(student);
    setShowStudentReviewModal(true);
  };

  const handleApproveRegistration = async (registrationId) => {
    try {
      await updateDoc(doc(db, 'registrations', registrationId), {
        status: 'approved',
        approvedAt: new Date()
      });
      fetchRegistrations();
      setShowStudentReviewModal(false);
      setSelectedStudent(null);
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
      setShowStudentReviewModal(false);
      setSelectedStudent(null);
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

  // Group students by class for reports
  // const getStudentsByClass = () => {
  //   const allRegistrations = [...pendingRegistrations, ...approvedRegistrations];
  //   const groupedByClass = {};
    
  //   allRegistrations.forEach(student => {
  //     const classId = student.classId;
  //     if (!groupedByClass[classId]) {
  //       groupedByClass[classId] = {
  //         class: student.class || { name: 'Unknown Class' },
  //         students: [],
  //         pending: 0,
  //         approved: 0,
  //         revenue: 0
  //       };
  //     }
      
  //     groupedByClass[classId].students.push(student);
      
  //     if (student.status === 'pending') {
  //       groupedByClass[classId].pending += 1;
  //     } else if (student.status === 'approved') {
  //       groupedByClass[classId].approved += 1;
  //       groupedByClass[classId].revenue += student.amountPaid || 0;
  //     }
  //   });
    
  //   return Object.values(groupedByClass);
  // };

  // Analytics Calculations
  const totalRevenue = approvedRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0);
  // const pendingRevenue = pendingRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0);
  const totalStudents = approvedRegistrations.length;
  const allRegistrations = [...pendingRegistrations, ...approvedRegistrations];
  // const studentsByClass = getStudentsByClass();

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
        {/* Compact Business Overview */}
        <section className="compact-analytics-section">
          <div className="compact-stats">
            <div className="compact-stat">
              <span className="compact-stat-icon">🏢</span>
              <div>
                <div className="compact-stat-number">{classes.length}</div>
                <div className="compact-stat-label">Classes</div>
              </div>
            </div>
            <div className="compact-stat">
              <span className="compact-stat-icon">👥</span>
              <div>
                <div className="compact-stat-number">{totalStudents}</div>
                <div className="compact-stat-label">Students</div>
              </div>
            </div>
            <div className="compact-stat">
              <span className="compact-stat-icon">💰</span>
              <div>
                <div className="compact-stat-number">R{totalRevenue.toFixed(2)}</div>
                <div className="compact-stat-label">Revenue</div>
              </div>
            </div>
            <div className="compact-stat">
              <span className="compact-stat-icon">⏳</span>
              <div>
                <div className="compact-stat-number">{pendingRegistrations.length}</div>
                <div className="compact-stat-label">Pending</div>
              </div>
            </div>
          </div>
        </section>

        {/* Desktop Tabs */}
        <div className="desktop-tabs">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'classes' ? 'active' : ''}`}
              onClick={() => setActiveTab('classes')}
            >
              🏢 My Classes ({classes.length})
            </button>
            <button 
              className={`tab ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              👥 Students ({allRegistrations.length})
              {pendingRegistrations.length > 0 && (
                <span className="tab-badge">{pendingRegistrations.length}</span>
              )}
            </button>
            <button 
              className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              📊 Reports
            </button>
          </div>
        </div>

        {/* Main Content */}
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
                        <div className="info-item">
                          <span className="label">Enrolled:</span>
                          <span className="value">{classItem.enrolledCount || 0} students</span>
                        </div>
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

     {activeTab === 'students' && (
  <section className="section">
    <div className="section-header">
      <h2>All Students</h2>
      <div className="filters">
        <select className="form-control form-control-sm" style={{width: '200px'}}>
          <option value="all">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="form-control form-control-sm" style={{width: '150px'}}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
        </select>
      </div>
    </div>

    {allRegistrations.length === 0 ? (
      <div className="empty-state">
        <div className="empty-icon">👥</div>
        <h3>No students yet</h3>
        <p>Students will appear here when they register for your classes.</p>
      </div>
    ) : (
      <div className="table-container">
        <table className="students-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {allRegistrations.map(student => {
              const isPending = student.status === 'pending';
              
              return (
                <tr key={student.id} className={isPending ? 'pending-row' : 'approved-row'}>
                  <td>
                    <div className="student-info">
                      <div className="student-name">{student.studentName}</div>
                      <div className="student-phone">{student.studentPhone}</div>
                    </div>
                  </td>
                  <td>{student.className || student.class?.name || 'Unknown Class'}</td>
                  <td>
                    <div>R{student.amountPaid || student.paymentAmount || 0}</div>
                    <div className="payment-date">
                      {student.paymentDate?.toDate 
                        ? student.paymentDate.toDate().toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : 'N/A'}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-${student.status || 'pending'}`}>
                      {student.status || 'pending'}
                    </span>
                  </td>
                  <td>
                    {isPending ? (
                      <button 
                        className="btn btn-warning btn-sm"
                        onClick={() => handleViewStudentDetails(student)}
                      >
                        Review
                      </button>
                    ) : (
                      <span className="text-muted">Reviewed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
)}
      {activeTab === 'reports' && (
  <section className="section">
    <div className="section-header">
      <h2>Student Registrations by Class</h2>
      <div className="revenue-badge">
        Total Revenue: R{totalRevenue.toFixed(2)}
      </div>
    </div>

    {/* All Classes with Simple Stats and Download */}
    <div className="all-classes-table-container">
      <table className="all-classes-table">
        <thead>
          <tr>
            <th>Class Name</th>
                        <th>Download</th>

            {/* <th>Status</th> */}
            <th>Total Students</th>
            {/* <th>Approved</th> */}
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((classItem) => {
            // Get students for this class
            const classStudents = allRegistrations.filter(student => student.classId === classItem.id);
            const approvedStudents = classStudents.filter(s => s.status === 'approved');
            const classRevenue = approvedStudents.reduce((sum, student) => sum + (student.amountPaid || 0), 0);
            
            // Function to download class students as CSV
            // const downloadClassStudentsCSV = () => {
            //   if (classStudents.length === 0) {
            //     showNotification('No students to download for this class', 'warning');
            //     return;
            //   }
              
            //   const headers = ['Student Name', 'Email', 'Phone', 'Status', 'Amount Paid', 'Payment Date', 'Registration Date'];
              
            //   const rows = classStudents.map(student => [
            //     student.studentName || '',
            //     student.studentEmail || '',
            //     student.studentPhone || '',
            //     student.status || '',
            //     `R${student.amountPaid || 0}`,
            //     student.paymentDate || '',
            //     student.createdAt ? new Date(student.createdAt).toLocaleDateString() : ''
            //   ]);
              
            //   const csvContent = [headers, ...rows]
            //     .map(row => row.map(field => `"${field}"`).join(','))
            //     .join('\n');
              
            //   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            //   const link = document.createElement('a');
            //   const url = URL.createObjectURL(blob);
              
            //   link.setAttribute('href', url);
            //   link.setAttribute('download', `${classItem.name.replace(/[^a-z0-9]/gi, '-')}-students-${new Date().toISOString().split('T')[0]}.csv`);
            //   link.style.visibility = 'hidden';
              
            //   document.body.appendChild(link);
            //   link.click();
            //   document.body.removeChild(link);
              
            //   showNotification(`Downloaded ${classStudents.length} students from ${classItem.name}`);
            // };

            // Function to download class students as PDF
            const downloadClassStudentsPDF = async () => {
              if (classStudents.length === 0) {
                showNotification('No students to download for this class', 'warning');
                return;
              }
              
              try {
                const { jsPDF } = await import('jspdf');
                const pdf = new jsPDF('p', 'mm', 'a4');
                let yPosition = 20;
                
                // Header
                pdf.setFontSize(20);
                pdf.setTextColor(44, 62, 80);
                pdf.text(`${classItem.name} - Student List`, 20, yPosition);
                
                pdf.setFontSize(12);
                pdf.setTextColor(128, 128, 128);
                pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 20, yPosition + 8);
                pdf.text(`Total Students: ${classStudents.length}`, 20, yPosition + 16);
                
                yPosition += 30;
                
                // Student Table Header
                pdf.setFontSize(14);
                pdf.setTextColor(44, 62, 80);
                pdf.text('Student Details:', 20, yPosition);
                yPosition += 10;
                
                pdf.setFontSize(9);
                pdf.setTextColor(0, 0, 0);
                const headers = ['Name', 'Email', 'Phone', 'Status', 'Amount'];
                let x = 20;
                const colWidths = [40, 50, 35, 25, 20];
                
                // Table Headers
                pdf.setFont(undefined, 'bold');
                headers.forEach((header, i) => {
                  pdf.text(header, x, yPosition);
                  x += colWidths[i];
                });
                
                yPosition += 7;
                pdf.setDrawColor(200, 200, 200);
                pdf.line(20, yPosition, 190, yPosition);
                yPosition += 4;
                
                // Table Rows
                pdf.setFont(undefined, 'normal');
                classStudents.forEach(student => {
                  if (yPosition > 270) {
                    pdf.addPage();
                    yPosition = 20;
                  }
                  
                  x = 20;
                  const row = [
                    student.studentName?.substring(0, 15) || 'N/A',
                    student.studentEmail?.substring(0, 20) || 'N/A',
                    student.studentPhone || 'N/A',
                    student.status,
                    `R${student.amountPaid || 0}`
                  ];
                  
                  row.forEach((cell, i) => {
                    pdf.text(cell, x, yPosition);
                    x += colWidths[i];
                  });
                  
                  yPosition += 6;
                });
                
                // Footer
                pdf.setPage(pdf.getNumberOfPages());
                pdf.setFontSize(8);
                pdf.setTextColor(128, 128, 128);
                pdf.text(`Page ${pdf.getNumberOfPages()} of ${pdf.getNumberOfPages()}`, 180, 290, { align: 'right' });
                
                // Save PDF
                pdf.save(`${classItem.name.replace(/[^a-z0-9]/gi, '-')}-students-${new Date().toISOString().split('T')[0]}.pdf`);
                showNotification(`PDF downloaded for ${classItem.name}`);
              } catch (error) {
                console.error('Error generating PDF:', error);
                showNotification('Error generating PDF', 'error');
              }
            };

            return (
              <tr key={classItem.id} className="class-row">
                <td>
                  <div className="class-info-cell">
                    <div className="class-name">{classItem.name}</div>
                    <div className="class-meta">
                      <span className="class-venue">{classItem.venue}</span>
                      {classItem.startDate && (
                        <span className="class-date">
                          {new Date(classItem.startDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                 <td>
                  <div className="download-actions">
                    {classStudents.length > 0 ? (
                      <>
                      
                        <button 
                          // className="btn btn-outline btn-sm"
                                  className="btn btn-primary"

                          onClick={downloadClassStudentsPDF}
                          title="Download as PDF"
                        >
                          Download PDF
                        </button>
                      </>
                    ) : (
                      <span className="no-students">No students</span>
                    )}
                  </div>
                </td>
                {/* <td>
                  <span className={`status-badge status-${classItem.status || 'active'}`}>
                    {classItem.status || 'active'}gg
                  </span>
                </td> */}
                <td>
                  <div className="student-count-cell">
                    <span className="student-count">{classStudents.length}</span>
                  </div>
                </td>
                {/* <td>
                  <div className="approved-count-cell">
                    <span className="approved-count">{approvedStudents.length}</span>
                  </div>
                </td> */}
                <td>
                  <div className="revenue-cell">
                    <span className="revenue-amount">R{classRevenue.toFixed(2)}</span>
                  </div>
                </td>
               
              </tr>
            );
          })}
          
          {classes.length === 0 && (
            <tr>
              <td colSpan="6">
                <div className="empty-state">
                  <div className="empty-icon">📊</div>
                  <h3>No classes yet</h3>
                  <p>Create classes first to see registration reports.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* Quick Download All */}
    {/* <div className="download-all-section">
      <button 
        className="btn btn-primary"
        onClick={() => {
          // Download all classes data as one CSV
          const headers = ['Class', 'Student Name', 'Email', 'Phone', 'Status', 'Amount Paid', 'Payment Date'];
          
          const rows = [];
          classes.forEach(classItem => {
            const classStudents = allRegistrations.filter(student => student.classId === classItem.id);
            classStudents.forEach(student => {
              rows.push([
                classItem.name,
                student.studentName || '',
                student.studentEmail || '',
                student.studentPhone || '',
                student.status || '',
                `R${student.amountPaid || 0}`,
                student.paymentDate || ''
              ]);
            });
          });
          
          if (rows.length === 0) {
            showNotification('No students to download', 'warning');
            return;
          }
          
          const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
          
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          
          link.setAttribute('href', url);
          link.setAttribute('download', `all-classes-students-${new Date().toISOString().split('T')[0]}.csv`);
          link.style.visibility = 'hidden';
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          showNotification(`Downloaded ${rows.length} students from all classes`);
        }}
      >
        📥 Download All Students (CSV)
      </button>
      <p className="download-note">
        Download all student registrations from all classes in one CSV file.
      </p>
    </div> */}
  </section>
)}

        {/* Mobile Bottom Tabs */}
        <div className="mobile-bottom-tabs">
          <button 
            className={`tab ${activeTab === 'classes' ? 'active' : ''}`}
            onClick={() => setActiveTab('classes')}
          >
            <span className="tab-icon">🏢</span>
            <span className="tab-label">Classes</span>
          </button>
          <button 
            className={`tab ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <span className="tab-icon">👥</span>
            <span className="tab-label">Students</span>
            {pendingRegistrations.length > 0 && (
              <span className="tab-badge">{pendingRegistrations.length}</span>
            )}
          </button>
          <button 
            className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">Reports</span>
          </button>
        </div>

        {/* Student Review Modal */}
        {showStudentReviewModal && selectedStudent && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Review Student Registration</h2>
                <button 
                  className="close-btn"
                  onClick={() => {
                    setShowStudentReviewModal(false);
                    setSelectedStudent(null);
                  }}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <div className="student-details">
                  <h3>{selectedStudent.studentName}</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="label">Email:</span>
                      <span className="value">{selectedStudent.studentEmail}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Phone:</span>
                      <span className="value">{selectedStudent.studentPhone}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Class:</span>
                      <span className="value">{selectedStudent.class?.name}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Amount Paid:</span>
                      <span className="value">R{selectedStudent.amountPaid}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Payment Date:</span>
                      <span className="value"> {selectedStudent?.paymentDate?.toDate
    ? selectedStudent.paymentDate.toDate().toLocaleDateString()
    : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {selectedStudent.popBase64 && (
                  <div className="pop-section">
                    <h4>Proof of Payment</h4>
                    <button 
                      onClick={() => handleViewPop(selectedStudent.popBase64, selectedStudent.popFileName)}
                      className="btn btn-outline"
                    >
                      📎 View Proof of Payment
                    </button>
                  </div>
                )}

                <div className="modal-actions">
                  <button 
                    onClick={() => handleApproveRegistration(selectedStudent.id)}
                    className="btn btn-success"
                  >
                    ✅ Approve Registration
                  </button>
                  <button 
                    onClick={() => handleRejectRegistration(selectedStudent.id)}
                    className="btn btn-danger"
                  >
                    ❌ Reject Registration
                  </button>
                </div>
              </div>
            </div>
          </div>
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