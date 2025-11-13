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
import ClassStudentManagement from './ClassStudentManagement';
function OrgAdminDashboard() {
  const { userData, logout } = useAuth();
  const [classes, setClasses] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [approvedRegistrations, setApprovedRegistrations] = useState([]);
  const [activeTab, setActiveTab] = useState('classes');
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showEditClass, setShowEditClass] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
// Add this to your existing state in OrgAdminDashboard
const [selectedClass, setSelectedClass] = useState(null);
// const [studentFilter, setStudentFilter] = useState('all');
// const [studentSearch, setStudentSearch] = useState('');
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
        class: classData, // Store full class data, not just name
        classId: regData.classId // Ensure classId is preserved
      };
    })
  );

  const approvedData = await Promise.all(
    approvedSnapshot.docs.map(async (regDoc) => {
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
        class: classData, // Store full class data
        classId: regData.classId // Ensure classId is preserved
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
// Add these export functions before the return statement in your component

const exportToCSV = (type) => {
  let csvContent = '';
  let filename = '';

  switch (type) {
    case 'registrations':
      filename = `registrations-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = convertRegistrationsToCSV();
      break;
    case 'revenue':
      filename = `revenue-report-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = convertRevenueToCSV();
      break;
    case 'attendance':
      filename = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = convertAttendanceToCSV();
      break;
    default:
      return;
  }

  downloadCSV(csvContent, filename);
  showNotification(`${type} report exported successfully!`);
};

const convertRegistrationsToCSV = () => {
  const headers = ['Student Name', 'Email', 'Phone', 'Class', 'Amount Paid', 'Payment Date', 'Status', 'Attendance'];
  
  const rows = approvedRegistrations.map(reg => [
    reg.studentName || '',
    reg.studentEmail || '',
    reg.studentPhone || '',
    reg.class?.name || '',
    reg.amountPaid || 0,
    reg.paymentDate || '',
    'approved',
    reg.attended === true ? 'Present' : reg.attended === false ? 'Absent' : 'Not Marked'
  ]);

  return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
};

const convertRevenueToCSV = () => {
  const headers = ['Class Name', 'Students', 'Total Revenue', 'Average Revenue Per Student', 'Status'];
  
  const rows = classes.map(classItem => {
    const classStudents = approvedRegistrations.filter(reg => reg.classId === classItem.id);
    const classRevenue = classStudents.reduce((sum, student) => sum + (student.amountPaid || 0), 0);
    const avgRevenue = classStudents.length > 0 ? classRevenue / classStudents.length : 0;

    return [
      classItem.name,
      classStudents.length,
      classRevenue.toFixed(2),
      avgRevenue.toFixed(2),
      classItem.status || 'active'
    ];
  });

  return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
};

const convertAttendanceToCSV = () => {
  const headers = ['Class Name', 'Total Students', 'Present', 'Absent', 'Not Marked', 'Attendance Rate'];
  
  const rows = classes.map(classItem => {
    const classStudents = approvedRegistrations.filter(reg => reg.classId === classItem.id);
    const presentCount = classStudents.filter(s => s.attended === true).length;
    const absentCount = classStudents.filter(s => s.attended === false).length;
    const notMarkedCount = classStudents.filter(s => s.attended === undefined).length;
    const attendanceRate = classStudents.length > 0 
      ? ((presentCount / classStudents.length) * 100).toFixed(1) 
      : 0;

    return [
      classItem.name,
      classStudents.length,
      presentCount,
      absentCount,
      notMarkedCount,
      `${attendanceRate}%`
    ];
  });

  return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
};

const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
  // Analytics Calculations
  const totalRevenue = approvedRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0);
  const pendingRevenue = pendingRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0);
  const totalStudents = approvedRegistrations.length;
// PDF Export Functions
const exportToPDF = async (type) => {
  try {
    // Dynamically import jsPDF to reduce bundle size
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    
    // Add organization header
    pdf.setFontSize(20);
    pdf.setTextColor(44, 62, 80);
    pdf.text(userData?.organizationName || 'Business Report', 20, 30);
    
    pdf.setFontSize(12);
    pdf.setTextColor(128, 128, 128);
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 40);
    
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, 45, 190, 45);
    
    let content = [];
    let title = '';

    switch (type) {
      case 'summary':
        title = 'Business Summary Report';
        content = generateSummaryContent();
        break;
      case 'registrations':
        title = 'Student Registrations Report';
        content = generateRegistrationsContent();
        break;
      case 'revenue':
        title = 'Revenue Analysis Report';
        content = generateRevenueContent();
        break;
      default:
        return;
    }

    // Add title
    pdf.setFontSize(16);
    pdf.setTextColor(44, 62, 80);
    pdf.text(title, 20, 60);

    // Add content
    let yPosition = 80;
    content.forEach(item => {
      if (yPosition > 270) {
        pdf.addPage();
        yPosition = 20;
      }

      if (item.type === 'heading') {
        pdf.setFontSize(12);
        pdf.setTextColor(44, 62, 80);
        pdf.setFont(undefined, 'bold');
        pdf.text(item.text, 20, yPosition);
        yPosition += 8;
      } else if (item.type === 'text') {
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, 'normal');
        
        // Split long text into multiple lines
        const lines = pdf.splitTextToSize(item.text, 170);
        pdf.text(lines, 20, yPosition);
        yPosition += (lines.length * 6) + 2;
      } else if (item.type === 'table') {
        // Simple table implementation
        pdf.setFontSize(9);
        let tableY = yPosition;
        
        // Table headers
        pdf.setFont(undefined, 'bold');
        item.headers.forEach((header, index) => {
          pdf.text(header, 20 + (index * 45), tableY);
        });
        
        tableY += 6;
        pdf.setDrawColor(200, 200, 200);
        pdf.line(20, tableY, 190, tableY);
        tableY += 4;
        
        // Table rows
        pdf.setFont(undefined, 'normal');
        item.rows.forEach((row, rowIndex) => {
          if (tableY > 270) {
            pdf.addPage();
            tableY = 20;
          }
          
          row.forEach((cell, cellIndex) => {
            pdf.text(cell.toString(), 20 + (cellIndex * 45), tableY);
          });
          tableY += 6;
        });
        
        yPosition = tableY + 10;
      } else if (item.type === 'spacer') {
        yPosition += 10;
      }
    });

    // Add footer
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Page ${i} of ${pageCount}`, 180, 290, { align: 'right' });
    }

    // Save PDF
    pdf.save(`${type}-report-${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification(`${type} PDF exported successfully!`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    showNotification('Error generating PDF', 'error');
  }
};

const generateSummaryContent = () => {
  const content = [];
  
  // Key Metrics
  content.push({ type: 'heading', text: 'Key Business Metrics' });
  content.push({ type: 'text', text: `Total Classes: ${classes.length}` });
  content.push({ type: 'text', text: `Total Students: ${totalStudents}` });
  content.push({ type: 'text', text: `Total Revenue: R${totalRevenue.toFixed(2)}` });
  content.push({ type: 'text', text: `Pending Revenue: R${pendingRevenue.toFixed(2)}` });
  content.push({ type: 'spacer' });

  // Class Performance Summary
  content.push({ type: 'heading', text: 'Class Performance Summary' });
  const performanceHeaders = ['Class Name', 'Students', 'Revenue', 'Status'];
  const performanceRows = classes.map(classItem => {
    const classStudents = approvedRegistrations.filter(reg => reg.classId === classItem.id);
    const classRevenue = classStudents.reduce((sum, student) => sum + (student.amountPaid || 0), 0);
    
    return [
      classItem.name.substring(0, 20) + (classItem.name.length > 20 ? '...' : ''),
      classStudents.length.toString(),
      `R${classRevenue.toFixed(2)}`,
      classItem.status || 'active'
    ];
  });
  
  content.push({ type: 'table', headers: performanceHeaders, rows: performanceRows });
  content.push({ type: 'spacer' });

  // Revenue Breakdown
  content.push({ type: 'heading', text: 'Revenue Breakdown' });
  const activeClasses = classes.filter(c => c.status === 'active');
  const archivedClasses = classes.filter(c => c.status === 'archived');
  
  content.push({ type: 'text', text: `Active Classes: ${activeClasses.length}` });
  content.push({ type: 'text', text: `Archived Classes: ${archivedClasses.length}` });
  content.push({ type: 'text', text: `Average Revenue per Student: R${totalStudents > 0 ? (totalRevenue / totalStudents).toFixed(2) : '0.00'}` });

  return content;
};

const generateRegistrationsContent = () => {
  const content = [];
  
  content.push({ type: 'heading', text: 'Student Registrations Report' });
  content.push({ type: 'text', text: `Total Approved Registrations: ${approvedRegistrations.length}` });
  content.push({ type: 'text', text: `Pending Registrations: ${pendingRegistrations.length}` });
  content.push({ type: 'spacer' });

  // Attendance Summary
  const presentCount = approvedRegistrations.filter(s => s.attended === true).length;
  const absentCount = approvedRegistrations.filter(s => s.attended === false).length;
  const notMarkedCount = approvedRegistrations.filter(s => s.attended === undefined).length;
  
  content.push({ type: 'heading', text: 'Attendance Summary' });
  content.push({ type: 'text', text: `Present: ${presentCount} students` });
  content.push({ type: 'text', text: `Absent: ${absentCount} students` });
  content.push({ type: 'text', text: `Not Marked: ${notMarkedCount} students` });
  content.push({ type: 'spacer' });

  // Detailed Registrations Table
  content.push({ type: 'heading', text: 'Student Details' });
  const registrationHeaders = ['Name', 'Email', 'Class', 'Amount Paid', 'Attendance'];
  const registrationRows = approvedRegistrations.slice(0, 50).map(reg => [ // Limit to first 50 for PDF
    reg.studentName?.substring(0, 15) + (reg.studentName?.length > 15 ? '...' : '') || 'N/A',
    reg.studentEmail?.substring(0, 20) + (reg.studentEmail?.length > 20 ? '...' : '') || 'N/A',
    reg.class?.name?.substring(0, 15) + (reg.class?.name?.length > 15 ? '...' : '') || 'N/A',
    `R${reg.amountPaid || 0}`,
    reg.attended === true ? 'Present' : reg.attended === false ? 'Absent' : 'Not Marked'
  ]);
  
  content.push({ type: 'table', headers: registrationHeaders, rows: registrationRows });
  
  if (approvedRegistrations.length > 50) {
    content.push({ type: 'text', text: `... and ${approvedRegistrations.length - 50} more records` });
  }

  return content;
};

const generateRevenueContent = () => {
  const content = [];
  
  content.push({ type: 'heading', text: 'Revenue Analysis Report' });
  content.push({ type: 'text', text: `Total Revenue: R${totalRevenue.toFixed(2)}` });
  content.push({ type: 'text', text: `Pending Revenue: R${pendingRevenue.toFixed(2)}` });
  content.push({ type: 'spacer' });

  // Top Performing Classes
  content.push({ type: 'heading', text: 'Top Performing Classes by Revenue' });
  const topClasses = classes
    .map(classItem => {
      const classRevenue = approvedRegistrations
        .filter(reg => reg.classId === classItem.id)
        .reduce((sum, student) => sum + (student.amountPaid || 0), 0);
      return { ...classItem, revenue: classRevenue };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const revenueHeaders = ['Class Name', 'Students', 'Revenue', 'Status'];
  const revenueRows = topClasses.map(classItem => {
    const classStudents = approvedRegistrations.filter(reg => reg.classId === classItem.id);
    
    return [
      classItem.name.substring(0, 25) + (classItem.name.length > 25 ? '...' : ''),
      classStudents.length.toString(),
      `R${classItem.revenue.toFixed(2)}`,
      classItem.status || 'active'
    ];
  });
  
  content.push({ type: 'table', headers: revenueHeaders, rows: revenueRows });
  content.push({ type: 'spacer' });

  // Revenue Distribution
  content.push({ type: 'heading', text: 'Revenue Distribution' });
  const activeRevenue = classes
    .filter(c => c.status === 'active')
    .reduce((sum, classItem) => {
      const classRevenue = approvedRegistrations
        .filter(reg => reg.classId === classItem.id)
        .reduce((sum, student) => sum + (student.amountPaid || 0), 0);
      return sum + classRevenue;
    }, 0);

  const archivedRevenue = classes
    .filter(c => c.status === 'archived')
    .reduce((sum, classItem) => {
      const classRevenue = approvedRegistrations
        .filter(reg => reg.classId === classItem.id)
        .reduce((sum, student) => sum + (student.amountPaid || 0), 0);
      return sum + classRevenue;
    }, 0);

  content.push({ type: 'text', text: `Active Classes Revenue: R${activeRevenue.toFixed(2)}` });
  content.push({ type: 'text', text: `Archived Classes Revenue: R${archivedRevenue.toFixed(2)}` });

  return content;
};

// Bonus: Export All Reports as ZIP
const exportAllReports = async () => {
  try {
    const JSZip = await import('jszip');
    const zip = new JSZip();
    
    // Add CSV files
    zip.file("registrations.csv", convertRegistrationsToCSV());
    zip.file("revenue-report.csv", convertRevenueToCSV());
    zip.file("attendance-report.csv", convertAttendanceToCSV());
    
    // Generate and add PDF files (simplified versions)
    const { jsPDF } = await import('jspdf');
    
    // Create a simple summary PDF for the ZIP
    const summaryPdf = new jsPDF();
    summaryPdf.text(`Business Reports Export - ${new Date().toLocaleDateString()}`, 20, 30);
    summaryPdf.text(`Total Classes: ${classes.length}`, 20, 50);
    summaryPdf.text(`Total Students: ${totalStudents}`, 20, 60);
    summaryPdf.text(`Total Revenue: R${totalRevenue.toFixed(2)}`, 20, 70);
    zip.file("business-summary.pdf", summaryPdf.output('blob'));
    
    // Create ZIP file and download
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `business-reports-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('All reports exported successfully as ZIP file!');
  } catch (error) {
    console.error('Error generating ZIP:', error);
    showNotification('Error exporting all reports', 'error');
  }
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
       {/* Students Tab */}
{activeTab === 'students' && (
  <section className="section">
    <div className="section-header">
      <h2>Student Management</h2>
     
    </div>

   {/* Class Selection Screen */}
{!selectedClass && (
  <div className="class-selection-section">
    <div className="selection-header">
      <h3>Select a Class</h3>
      <p>Choose a class to view and manage students</p>
      <div className="revenue-badge">
        Total Platform Revenue: R{totalRevenue.toFixed(2)}
      </div>
    </div>
    
    <div className="classes-grid">
      {classes.map(classItem => {
        const classStudents = approvedRegistrations.filter(reg => reg.classId === classItem.id);
        const presentCount = classStudents.filter(s => s.attended === true).length;
        const absentCount = classStudents.filter(s => s.attended === false).length;
        const pendingCount = classStudents.filter(s => s.attended === undefined).length;
        const classRevenue = classStudents.reduce((sum, student) => sum + (student.amountPaid || 0), 0);
        
        return (
          <div 
            key={classItem.id} 
            className="class-selection-card"
            onClick={() => setSelectedClass(classItem)}
          >
            <div className="class-card-header">
              <h4>{classItem.name}</h4>
              <span className="student-count">
                {classStudents.length} students
              </span>
            </div>
            
            <div className="class-card-details">
              <div className="class-info">
                <span className="info-item">
                  <span className="icon">📅</span>
                  {classItem.startDate ? new Date(classItem.startDate).toLocaleDateString() : 'TBA'}
                </span>
                <span className="info-item">
                  <span className="icon">📍</span>
                  {classItem.venue || 'TBA'}
                </span>
                <span className="info-item revenue">
                  <span className="icon">💰</span>
                  R{classRevenue.toFixed(2)}
                </span>
              </div>
              <div className="attendance-overview">
                <div className="attendance-stats">
                  <span className="stat present">✅ {presentCount}</span>
                  <span className="stat absent">❌ {absentCount}</span>
                  <span className="stat pending">⏳ {pendingCount}</span>
                </div>
              </div>
            </div>
            
            <div className="class-card-footer">
              <div className="class-price">R{classItem.price}</div>
              <button className="view-students-btn">
                Manage Students →
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}

    {/* Student Management Screen */}
    {selectedClass && (
      <ClassStudentManagement 
        class={selectedClass}
        students={approvedRegistrations.filter(reg => reg.classId === selectedClass.id)}
        onBack={() => setSelectedClass(null)}
        onUpdateAttendance={fetchRegistrations} // Refresh data after changes
      />
    )}
  </section>
)}

     {/* Reports Tab */}
{activeTab === 'reports' && (
  <section className="section">
    <div className="section-header">
      <h2>Business Reports & Analytics</h2>
      <div className="revenue-badge">
        Total Revenue: R{totalRevenue.toFixed(2)}
      </div>
    </div>

    {/* Key Metrics Overview */}
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-icon">📊</div>
        <div className="metric-content">
          <div className="metric-value">{classes.length}</div>
          <div className="metric-label">Total Classes</div>
          <div className="metric-trend">
            {classes.filter(c => c.status === 'active').length} active
          </div>
        </div>
      </div>
      
      <div className="metric-card">
        <div className="metric-icon">👥</div>
        <div className="metric-content">
          <div className="metric-value">{totalStudents}</div>
          <div className="metric-label">Total Students</div>
          <div className="metric-trend">
            {approvedRegistrations.filter(r => r.attended === true).length} attended
          </div>
        </div>
      </div>
      
      <div className="metric-card">
        <div className="metric-icon">💰</div>
        <div className="metric-content">
          <div className="metric-value">R{totalRevenue.toFixed(2)}</div>
          <div className="metric-label">Total Revenue</div>
          <div className="metric-trend">
            R{pendingRevenue.toFixed(2)} pending
          </div>
        </div>
      </div>
      
      <div className="metric-card">
        <div className="metric-icon">📈</div>
        <div className="metric-content">
          <div className="metric-value">
            {classes.length > 0 ? (totalStudents / classes.length).toFixed(1) : 0}
          </div>
          <div className="metric-label">Avg Students/Class</div>
          <div className="metric-trend">
            {classes.length > 0 ? ((totalStudents / classes.length) * 100).toFixed(1) : 0}% capacity
          </div>
        </div>
      </div>
    </div>

    {/* Class Performance Report */}
    <div className="report-section">
      <h3>🎓 Class Performance</h3>
      <div className="table-container">
        <table className="report-table">
          <thead>
            <tr>
              <th>Class Name</th>
              <th>Status</th>
              <th>Students</th>
              <th>Revenue</th>
              <th>Attendance Rate</th>
              <th>Capacity Usage</th>
            </tr>
          </thead>
          <tbody>
            {classes.map(classItem => {
              const classStudents = approvedRegistrations.filter(reg => reg.classId === classItem.id);
              const presentCount = classStudents.filter(s => s.attended === true).length;
              const classRevenue = classStudents.reduce((sum, student) => sum + (student.amountPaid || 0), 0);
              const attendanceRate = classStudents.length > 0 
                ? ((presentCount / classStudents.length) * 100).toFixed(1) 
                : 0;
              const capacityUsage = classItem.capacity 
                ? ((classStudents.length / classItem.capacity) * 100).toFixed(1)
                : classStudents.length > 0 ? '100+' : 0;

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
                  <td>
                    <div className="attendance-bar">
                      <div 
                        className="attendance-fill"
                        style={{ width: `${attendanceRate}%` }}
                      ></div>
                      <span>{attendanceRate}%</span>
                    </div>
                  </td>
                  <td>
                    {classItem.capacity ? (
                      <div className="capacity-usage">
                        {classStudents.length}/{classItem.capacity} ({capacityUsage}%)
                      </div>
                    ) : (
                      <div className="capacity-usage">Unlimited</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* Revenue Analysis */}
    <div className="report-section">
      <h3>💰 Revenue Analysis</h3>
      <div className="revenue-breakdown">
        <div className="revenue-card">
          <h4>Total Revenue</h4>
          <div className="revenue-amount">R{totalRevenue.toFixed(2)}</div>
          <div className="revenue-detail">
            From {approvedRegistrations.length} approved registrations
          </div>
        </div>
        
        <div className="revenue-card">
          <h4>Pending Revenue</h4>
          <div className="revenue-amount pending">R{pendingRevenue.toFixed(2)}</div>
          <div className="revenue-detail">
            From {pendingRegistrations.length} pending registrations
          </div>
        </div>
        
        <div className="revenue-card">
          <h4>Average Payment</h4>
          <div className="revenue-amount">
            R{approvedRegistrations.length > 0 
              ? (totalRevenue / approvedRegistrations.length).toFixed(2) 
              : '0.00'}
          </div>
          <div className="revenue-detail">
            Per student registration
          </div>
        </div>
      </div>

      {/* Top Performing Classes by Revenue */}
      <div className="top-classes">
        <h4>Top Performing Classes by Revenue</h4>
        {classes
          .map(classItem => {
            const classRevenue = approvedRegistrations
              .filter(reg => reg.classId === classItem.id)
              .reduce((sum, student) => sum + (student.amountPaid || 0), 0);
            return { ...classItem, revenue: classRevenue };
          })
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
          .map((classItem, index) => (
            <div key={classItem.id} className="top-class-item">
              <div className="class-rank">#{index + 1}</div>
              <div className="class-info">
                <div className="class-name">{classItem.name}</div>
                <div className="class-stats">
                  {approvedRegistrations.filter(reg => reg.classId === classItem.id).length} students
                </div>
              </div>
              <div className="class-revenue">R{classItem.revenue.toFixed(2)}</div>
            </div>
          ))
        }
      </div>
    </div>

    {/* Student Analytics */}
    <div className="report-section">
      <h3>📊 Student Analytics</h3>
      <div className="student-stats-grid">
        <div className="student-stat-card">
          <h4>Attendance Overview</h4>
          <div className="attendance-stats">
            <div className="attendance-item">
              <span className="attendance-label present">Present</span>
              <span className="attendance-count">
                {approvedRegistrations.filter(s => s.attended === true).length}
              </span>
            </div>
            <div className="attendance-item">
              <span className="attendance-label absent">Absent</span>
              <span className="attendance-count">
                {approvedRegistrations.filter(s => s.attended === false).length}
              </span>
            </div>
            <div className="attendance-item">
              <span className="attendance-label pending">Not Marked</span>
              <span className="attendance-count">
                {approvedRegistrations.filter(s => s.attended === undefined).length}
              </span>
            </div>
          </div>
        </div>

        <div className="student-stat-card">
          <h4>Registration Timeline</h4>
          <div className="timeline-stats">
            {/* Last 7 days registrations */}
            {(() => {
              const last7Days = [];
              for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const dayRegistrations = approvedRegistrations.filter(reg => 
                  reg.paymentDate === dateStr
                ).length;
                last7Days.push({ date: dateStr, count: dayRegistrations });
              }
              return last7Days.map(day => (
                <div key={day.date} className="timeline-item">
                  <span className="timeline-date">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="timeline-count">{day.count}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>

    {/* Export Options */}
  <div className="report-section">
  <h3>📤 Export Reports</h3>
  <div className="export-options">
    {/* CSV Export Buttons */}
    <div className="export-group">
      <h4>CSV Export</h4>
      <div className="export-buttons">
        <button 
          className="btn btn-outline"
          onClick={() => exportToCSV('registrations')}
        >
          📥 Export Registrations CSV
        </button>
        <button 
          className="btn btn-outline"
          onClick={() => exportToCSV('revenue')}
        >
          📥 Export Revenue Report CSV
        </button>
        <button 
          className="btn btn-outline"
          onClick={() => exportToCSV('attendance')}
        >
          📥 Export Attendance Report CSV
        </button>
      </div>
    </div>

    {/* PDF Export Buttons */}
    <div className="export-group">
      <h4>PDF Export</h4>
      <div className="export-buttons">
        <button 
          className="btn btn-outline btn-pdf"
          onClick={() => exportToPDF('summary')}
        >
          📄 Export Summary PDF
        </button>
        <button 
          className="btn btn-outline btn-pdf"
          onClick={() => exportToPDF('registrations')}
        >
          📄 Export Registrations PDF
        </button>
        <button 
          className="btn btn-outline btn-pdf"
          onClick={() => exportToPDF('revenue')}
        >
          📄 Export Revenue PDF
        </button>
      </div>
    </div>

    {/* Quick Export All */}
    {/* <div className="export-group">
      <h4>Quick Export</h4>
      <button 
        className="btn btn-primary"
        onClick={exportAllReports}
      >
        🚀 Export All Reports (ZIP)
      </button>
    </div> */}
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