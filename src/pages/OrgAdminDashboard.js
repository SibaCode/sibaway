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

  // -------------------
  // Fetch Functions
  // -------------------
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
  }, [userData]);

  const fetchRegistrations = useCallback(async () => {
    if (!userData?.organizationId) return;

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

    const mapRegData = async (snapshot) => Promise.all(
      snapshot.docs.map(async (regDoc) => {
        const regData = regDoc.data();
        const classDoc = await getDoc(doc(db, 'classes', regData.classId));
        const className = classDoc.exists()
          ? `/${classDoc.data().courseSlug}/${classDoc.data().venueSlug}/${classDoc.data().dateSlug}`
          : 'Class Not Found';
        return { id: regDoc.id, ...regData, class: { name: className } };
      })
    );

    setPendingRegistrations(await mapRegData(pendingSnapshot));
    setApprovedRegistrations(await mapRegData(approvedSnapshot));
  }, [userData]);

  // -------------------
  // useEffect to fetch data
  // -------------------
  useEffect(() => {
    if (userData?.organizationId) {
      fetchClasses();
      fetchRegistrations();
    }
  }, [userData, fetchClasses, fetchRegistrations]);

  // -------------------
  // Notifications
  // -------------------
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  // -------------------
  // Class Management Functions
  // -------------------
  const createClass = async (e) => {
    e.preventDefault();
    try {
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

      const businessName = userData?.organizationName || userData?.name || 'My Business';
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
        businessSlug,
        courseSlug: finalCourseSlug,
        venueSlug,
        dateSlug,
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

  // ... Keep all other functions (editClass, updateClass, duplicateClass, archiveClass, deleteClass, registration management, UI rendering) exactly as is

  return (
    <div className="dashboard">
      {/* Notification System */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification({ show: false, message: '', type: '' })}>×</button>
        </div>
      )}
      {/* Rest of UI stays unchanged */}
    </div>
  );
}

export default OrgAdminDashboard;
