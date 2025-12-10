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
  const [showStudentReviewModal, setShowStudentReviewModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [exportingPDF, setExportingPDF] = useState(false);

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
    // const rejected = allRegistrations.filter(reg => reg.status === 'rejected');
    
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

  // PDF Export Functions
  const exportToPDF = async (type) => {
    try {
      setExportingPDF(true);
      
      // Dynamically import jsPDF
      const { jsPDF } = await import('jspdf');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      let yPosition = 20;
      
      // Add header
      pdf.setFontSize(20);
      pdf.setTextColor(44, 62, 80);
      pdf.text(`${userData?.organizationName || 'Business'} - ${type.charAt(0).toUpperCase() + type.slice(1)} Report`, 20, yPosition);
      
      pdf.setFontSize(12);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 20, yPosition + 10);
      
      yPosition += 25;
      
      // Add content based on type
      switch (type) {
        case 'summary':
          generateSummaryPDF(pdf, yPosition);
          break;
        case 'registrations':
          generateRegistrationsPDF(pdf, yPosition);
          break;
        case 'revenue':
          generateRevenuePDF(pdf, yPosition);
          break;
        default:
          break;
      }
      
      // Save PDF
      pdf.save(`${type}-report-${new Date().toISOString().split('T')[0]}.pdf`);
      showNotification(`${type} PDF exported successfully!`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      showNotification('Error generating PDF', 'error');
    } finally {
      setExportingPDF(false);
    }
  };

  const generateSummaryPDF = (pdf, startY) => {
    let y = startY;
    
    // Key Metrics
    pdf.setFontSize(16);
    pdf.setTextColor(44, 62, 80);
    pdf.text('Key Metrics', 20, y);
    y += 10;
    
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    
    const metrics = [
      `Total Classes: ${classes.length}`,
      `Active Classes: ${classes.filter(c => c.status === 'active').length}`,
      `Archived Classes: ${classes.filter(c => c.status === 'archived').length}`,
      `Total Students: ${approvedRegistrations.length}`,
      `Pending Approvals: ${pendingRegistrations.length}`,
      `Total Revenue: R${totalRevenue.toFixed(2)}`,
      `Pending Revenue: R${pendingRevenue.toFixed(2)}`,
      `Average Revenue per Student: R${approvedRegistrations.length > 0 ? (totalRevenue / approvedRegistrations.length).toFixed(2) : '0.00'}`
    ];
    
    metrics.forEach(metric => {
      pdf.text(metric, 20, y);
      y += 7;
    });
    
    y += 10;
    
    // Class Performance Table
    pdf.setFontSize(16);
    pdf.setTextColor(44, 62, 80);
    pdf.text('Class Performance', 20, y);
    y += 10;
    
    pdf.setFontSize(8);
    const headers = ['Class Name', 'Status', 'Students', 'Revenue', 'Capacity'];
    let x = 20;
    
    // Headers
    headers.forEach(header => {
      pdf.setFont(undefined, 'bold');
      pdf.text(header, x, y);
      x += 35;
    });
    
    y += 7;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, y, 190, y);
    y += 4;
    
    // Rows
    pdf.setFont(undefined, 'normal');
    classes.forEach(classItem => {
      const classStudents = approvedRegistrations.filter(reg => reg.classId === classItem.id);
      const classRevenue = classStudents.reduce((sum, student) => sum + (student.amountPaid || 0), 0);
      const capacity = classItem.capacity || 'Unlimited';
      
      x = 20;
      const row = [
        classItem.name.substring(0, 15) + (classItem.name.length > 15 ? '...' : ''),
        classItem.status || 'active',
        classStudents.length.toString(),
        `R${classRevenue.toFixed(2)}`,
        capacity.toString()
      ];
      
      row.forEach(cell => {
        pdf.text(cell, x, y);
        x += 35;
      });
      
      y += 6;
      
      // Add new page if needed
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
    });
  };

  const generateRegistrationsPDF = (pdf, startY) => {
    let y = startY;
    
    // Registration Summary
    pdf.setFontSize(16);
    pdf.setTextColor(44, 62, 80);
    pdf.text('Registration Summary', 20, y);
    y += 10;
    
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    
    const summary = [
      `Total Registrations: ${approvedRegistrations.length + pendingRegistrations.length}`,
      `Approved: ${approvedRegistrations.length}`,
      `Pending: ${pendingRegistrations.length}`,
      `Approval Rate: ${approvedRegistrations.length > 0 ? ((approvedRegistrations.length / (approvedRegistrations.length + pendingRegistrations.length)) * 100).toFixed(1) : 0}%`
    ];
    
    summary.forEach(item => {
      pdf.text(item, 20, y);
      y += 7;
    });
    
    y += 10;
    
    // Recent Registrations Table
    pdf.setFontSize(16);
    pdf.setTextColor(44, 62, 80);
    pdf.text('Recent Registrations', 20, y);
    y += 10;
    
    pdf.setFontSize(8);
    const headers = ['Name', 'Class', 'Amount', 'Status', 'Date'];
    let x = 20;
    const colWidths = [40, 40, 30, 30, 30];
    
    // Headers
    headers.forEach((header, i) => {
      pdf.setFont(undefined, 'bold');
      pdf.text(header, x, y);
      x += colWidths[i];
    });
    
    y += 7;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, y, 190, y);
    y += 4;
    
    // Rows (limit to 20 most recent)
    const allRegistrations = [...approvedRegistrations, ...pendingRegistrations];
    const recentRegistrations = allRegistrations
      .sort((a, b) => new Date(b.paymentDate || b.createdAt) - new Date(a.paymentDate || a.createdAt))
      .slice(0, 20);
    
    recentRegistrations.forEach(reg => {
      x = 20;
      const row = [
        reg.studentName?.substring(0, 15) + (reg.studentName?.length > 15 ? '...' : '') || 'N/A',
        reg.class?.name?.substring(0, 15) + (reg.class?.name?.length > 15 ? '...' : '') || 'N/A',
        `R${reg.amountPaid || 0}`,
        reg.status,
        reg.paymentDate || 'N/A'
      ];
      
      row.forEach((cell, i) => {
        pdf.text(cell, x, y);
        x += colWidths[i];
      });
      
      y += 6;
      
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
    });
  };

  const generateRevenuePDF = (pdf, startY) => {
    let y = startY;
    
    // Revenue Summary
    pdf.setFontSize(16);
    pdf.setTextColor(44, 62, 80);
    pdf.text('Revenue Analysis', 20, y);
    y += 10;
    
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    
    const summary = [
      `Total Revenue: R${totalRevenue.toFixed(2)}`,
      `Pending Revenue: R${pendingRevenue.toFixed(2)}`,
      `Average Payment: R${approvedRegistrations.length > 0 ? (totalRevenue / approvedRegistrations.length).toFixed(2) : '0.00'}`,
      `Total Transactions: ${approvedRegistrations.length}`
    ];
    
    summary.forEach(item => {
      pdf.text(item, 20, y);
      y += 7;
    });
    
    y += 10;
    
    // Revenue by Class
    pdf.setFontSize(16);
    pdf.setTextColor(44, 62, 80);
    pdf.text('Revenue by Class', 20, y);
    y += 10;
    
    pdf.setFontSize(8);
    const headers = ['Class Name', 'Students', 'Revenue', 'Avg/Student', 'Status'];
    let x = 20;
    const colWidths = [40, 25, 35, 35, 25];
    
    // Headers
    headers.forEach((header, i) => {
      pdf.setFont(undefined, 'bold');
      pdf.text(header, x, y);
      x += colWidths[i];
    });
    
    y += 7;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, y, 190, y);
    y += 4;
    
    // Rows
    pdf.setFont(undefined, 'normal');
    const revenueByClass = classes.map(classItem => {
      const classStudents = approvedRegistrations.filter(reg => reg.classId === classItem.id);
      const classRevenue = classStudents.reduce((sum, student) => sum + (student.amountPaid || 0), 0);
      const avgRevenue = classStudents.length > 0 ? classRevenue / classStudents.length : 0;
      
      return {
        name: classItem.name,
        students: classStudents.length,
        revenue: classRevenue,
        avgRevenue: avgRevenue,
        status: classItem.status || 'active'
      };
    }).sort((a, b) => b.revenue - a.revenue);
    
    revenueByClass.forEach(item => {
      x = 20;
      const row = [
        item.name.substring(0, 15) + (item.name.length > 15 ? '...' : ''),
        item.students.toString(),
        `R${item.revenue.toFixed(2)}`,
        `R${item.avgRevenue.toFixed(2)}`,
        item.status
      ];
      
      row.forEach((cell, i) => {
        pdf.text(cell, x, y);
        x += colWidths[i];
      });
      
      y += 6;
      
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
    });
  };

  // Analytics Calculations
  const totalRevenue = approvedRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0);
  const pendingRevenue = pendingRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0);
  const totalStudents = approvedRegistrations.length;
  const allRegistrations = [...pendingRegistrations, ...approvedRegistrations];

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

        {/* Desktop Tabs (Visible on desktop) */}
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
                  <option value="rejected">Rejected</option>
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
                      const isRejected = student.status === 'rejected';
                      
                      return (
                        <tr key={student.id} className={isPending ? 'pending-row' : isRejected ? 'rejected-row' : 'approved-row'}>
                          <td>
                            <div className="student-info">
                              <div className="student-name">{student.studentName}</div>
                              <div className="student-email">{student.studentEmail}</div>
                              <div className="student-phone">{student.studentPhone}</div>
                            </div>
                          </td>
                          <td>{student.class?.name || 'Unknown Class'}</td>
                          <td>
                            <div>R{student.amountPaid || 0}</div>
                            <div className="payment-date">{student.paymentDate}</div>
                          </td>
                          <td>
                            <span className={`status-badge status-${student.status}`}>
                              {student.status}
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
              <h2>Reports & Analytics</h2>
              <div className="revenue-badge">
                Total Revenue: R{totalRevenue.toFixed(2)}
              </div>
            </div>

            {/* Report Cards */}
            <div className="report-cards-grid">
              <div className="report-card">
                <h3>📊 Business Summary</h3>
                <div className="report-metrics">
                  <div className="metric-row">
                    <span className="metric-label">Total Classes</span>
                    <span className="metric-value">{classes.length}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Active Classes</span>
                    <span className="metric-value">{classes.filter(c => c.status === 'active').length}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Total Students</span>
                    <span className="metric-value">{totalStudents}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Pending Approvals</span>
                    <span className="metric-value">{pendingRegistrations.length}</span>
                  </div>
                </div>
                <button 
                  className="btn btn-primary"
                  onClick={() => exportToPDF('summary')}
                  disabled={exportingPDF}
                >
                  {exportingPDF ? 'Generating...' : '📥 Download Summary PDF'}
                </button>
              </div>

              <div className="report-card">
                <h3>👥 Student Registrations</h3>
                <div className="report-metrics">
                  <div className="metric-row">
                    <span className="metric-label">Total Registrations</span>
                    <span className="metric-value">{allRegistrations.length}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Approved</span>
                    <span className="metric-value">{approvedRegistrations.length}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Pending</span>
                    <span className="metric-value">{pendingRegistrations.length}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Approval Rate</span>
                    <span className="metric-value">
                      {allRegistrations.length > 0 
                        ? `${((approvedRegistrations.length / allRegistrations.length) * 100).toFixed(1)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
                <button 
                  className="btn btn-primary"
                  onClick={() => exportToPDF('registrations')}
                  disabled={exportingPDF}
                >
                  {exportingPDF ? 'Generating...' : '📥 Download Registrations PDF'}
                </button>
              </div>

              <div className="report-card">
                <h3>💰 Revenue Analysis</h3>
                <div className="report-metrics">
                  <div className="metric-row">
                    <span className="metric-label">Total Revenue</span>
                    <span className="metric-value">R{totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Pending Revenue</span>
                    <span className="metric-value">R{pendingRevenue.toFixed(2)}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Average Payment</span>
                    <span className="metric-value">
                      R{approvedRegistrations.length > 0 
                        ? (totalRevenue / approvedRegistrations.length).toFixed(2) 
                        : '0.00'}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Transactions</span>
                    <span className="metric-value">{approvedRegistrations.length}</span>
                  </div>
                </div>
                <button 
                  className="btn btn-primary"
                  onClick={() => exportToPDF('revenue')}
                  disabled={exportingPDF}
                >
                  {exportingPDF ? 'Generating...' : '📥 Download Revenue PDF'}
                </button>
              </div>
            </div>

            {/* Detailed Reports Section */}
            <div className="detailed-reports">
              <h3>Detailed Reports</h3>
              
              {/* Class Performance Table */}
              <div className="report-section">
                <h4>🎓 Class Performance</h4>
                <div className="table-container">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Class Name</th>
                        <th>Status</th>
                        <th>Students</th>
                        <th>Revenue</th>
                        <th>Average/Student</th>
                        <th>Attendance Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map(classItem => {
                        const classStudents = approvedRegistrations.filter(reg => reg.classId === classItem.id);
                        const presentCount = classStudents.filter(s => s.attended === true).length;
                        const classRevenue = classStudents.reduce((sum, student) => sum + (student.amountPaid || 0), 0);
                        const avgRevenue = classStudents.length > 0 ? classRevenue / classStudents.length : 0;
                        const attendanceRate = classStudents.length > 0 
                          ? ((presentCount / classStudents.length) * 100).toFixed(1) 
                          : 0;

                        return (
                          <tr key={classItem.id}>
                            <td className="class-name">{classItem.name}</td>
                            <td>
                              <span className={`status-badge status-${classItem.status || 'active'}`}>
                                {classItem.status || 'active'}
                              </span>
                            </td>
                            <td>{classStudents.length}</td>
                            <td>R{classRevenue.toFixed(2)}</td>
                            <td>R{avgRevenue.toFixed(2)}</td>
                            <td>
                              <div className="attendance-bar">
                                <div 
                                  className="attendance-fill"
                                  style={{ width: `${attendanceRate}%` }}
                                ></div>
                                <span>{attendanceRate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Export All Button */}
              <div className="export-all-section">
                <button 
                  className="btn btn-primary btn-lg"
                  onClick={async () => {
                    setExportingPDF(true);
                    await exportToPDF('summary');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await exportToPDF('registrations');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await exportToPDF('revenue');
                    setExportingPDF(false);
                    showNotification('All reports exported successfully!');
                  }}
                  disabled={exportingPDF}
                >
                  {exportingPDF ? 'Exporting All Reports...' : '🚀 Export All PDF Reports'}
                </button>
                <p className="export-note">
                  This will generate and download three separate PDF reports: Summary, Registrations, and Revenue Analysis.
                </p>
              </div>
            </div>
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
                      <span className="value">{selectedStudent.paymentDate}</span>
                    </div>
                    {selectedStudent.transactionId && (
                      <div className="info-item">
                        <span className="label">Transaction ID:</span>
                        <span className="value code">{selectedStudent.transactionId}</span>
                      </div>
                    )}
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