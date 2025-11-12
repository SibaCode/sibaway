// import React, { useState, useEffect } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
// import { db } from '../firebase/config';

// function StudentDashboard() {
//   const { currentUser, userData, logout } = useAuth();
//   const [registrations, setRegistrations] = useState([]);
//   const [loading, setLoading] = useState(true);

// //   useEffect(() => {
// //     if (currentUser) {
// //       fetchRegistrations();
// //     } else {
// //       setLoading(false);
// //     }
// //   }, [currentUser]);

//   const fetchRegistrations = async () => {
//     try {
//       if (!currentUser?.uid) {
//         console.log('No user UID available');
//         return;
//       }

//       const q = query(
//         collection(db, 'registrations'),
//         where('studentId', '==', currentUser.uid)
//       );
      
//       const querySnapshot = await getDocs(q);
//       const registrationsData = await Promise.all(
//         querySnapshot.docs.map(async (registrationDoc) => {
//           const data = registrationDoc.data();
//           let classData = null;
          
//           try {
//             if (data.classId) {
//               const classDoc = await getDoc(doc(db, 'classes', data.classId));
//               if (classDoc.exists()) {
//                 classData = classDoc.data();
//               }
//             }
//           } catch (error) {
//             console.error('Error fetching class:', error);
//           }
          
//           return {
//             id: registrationDoc.id,
//             ...data,
//             class: classData
//           };
//         })
//       );
      
//       setRegistrations(registrationsData);
//     } catch (error) {
//       console.error('Error fetching registrations:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const getStatusBadge = (status) => {
//     switch (status) {
//       case 'approved':
//         return <span className="status-badge status-approved">Approved</span>;
//       case 'rejected':
//         return <span className="status-badge status-rejected">Rejected</span>;
//       default:
//         return <span className="status-badge status-pending">Pending</span>;
//     }
//   };

//   if (loading) {
//     return (
//       <div className="dashboard">
//         <div className="loading"><div className="spinner"></div></div>
//       </div>
//     );
//   }

//   return (
//     <div className="dashboard">
//       <nav className="navbar">
//         <div className="navbar-brand">
//           <span>🚀 SibaWay</span>
//         </div>
//         <ul className="navbar-nav">
//           <li>
//             <button onClick={logout} className="btn btn-outline">
//               Logout ({userData?.name || 'Student'})
//             </button>
//           </li>
//         </ul>
//       </nav>

//       <div className="dashboard-content">
//         <div className="header-section">
//           <h1>Welcome, {userData?.name || 'Student'}</h1>
//           <p>View your class registrations and status</p>
//         </div>

//         <section>
//           <h2>My Registrations ({registrations.length})</h2>
//           {registrations.length === 0 ? (
//             <div className="class-card">
//               <p>You haven't registered for any classes yet.</p>
//               <p>Ask your instructor for a registration link to get started!</p>
//             </div>
//           ) : (
//             <div className="classes-grid">
//               {registrations.map(reg => (
//                 <div key={reg.id} className="class-card">
//                   <div className="registration-header">
//                     <h3>{reg.class?.name || 'Unknown Class'}</h3>
//                     {getStatusBadge(reg.status)}
//                   </div>
                  
//                   {reg.class?.description && (
//                     <p><strong>Description:</strong> {reg.class.description}</p>
//                   )}
                  
//                   <p><strong>Registered:</strong> {reg.registeredAt?.toDate().toLocaleDateString()}</p>
//                   <p><strong>Amount Paid:</strong> ${reg.amountPaid || '0'}</p>
//                   <p><strong>Payment Date:</strong> {reg.paymentDate}</p>
                  
//                   {reg.status === 'approved' && (
//                     <div style={{marginTop: '1rem', padding: '1rem', background: 'var(--success)', color: 'white', borderRadius: '8px'}}>
//                       <strong>✅ Approved!</strong> You now have access to this class.
//                     </div>
//                   )}
                  
//                   {reg.status === 'rejected' && (
//                     <div style={{marginTop: '1rem', padding: '1rem', background: 'var(--danger)', color: 'white', borderRadius: '8px'}}>
//                       <strong>❌ Rejected:</strong> Please contact the business owner for more information.
//                     </div>
//                   )}
//                 </div>
//               ))}
//             </div>
//           )}
//         </section>
//       </div>
//     </div>
//   );
// }

// export default StudentDashboard;