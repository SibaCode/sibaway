// ClassStudentManagement.jsx - Updated version
import React, { useState } from 'react';
import { updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

function ClassStudentManagement({ class: classData, students, onBack, onUpdateAttendance }) {
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({ subject: '', message: '', type: 'email' });
  const [sending, setSending] = useState(false);

  // Calculate revenue for THIS class only
  const classRevenue = students.reduce((sum, student) => sum + (parseFloat(student.amountPaid) || 0), 0);

  // Filter students
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.studentEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'present') return matchesSearch && student.attended === true;
    if (filter === 'absent') return matchesSearch && student.attended === false;
    if (filter === 'pending') return matchesSearch && (student.attended === undefined || student.attended === null);
    
    return matchesSearch;
  });

  // Attendance stats
  const stats = {
    total: students.length,
    present: students.filter(s => s.attended === true).length,
    absent: students.filter(s => s.attended === false).length,
    pending: students.filter(s => s.attended === undefined || s.attended === null).length
  };

  // Toggle student selection
  const toggleStudentSelection = (studentId) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  // Select all filtered students
  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  };

  // Mark attendance for single student
  const markAttendance = async (studentId, attended) => {
    try {
      await updateDoc(doc(db, 'registrations', studentId), {
        attended: attended,
        lastAttendanceDate: new Date(),
        attendanceHistory: [...(students.find(s => s.id === studentId)?.attendanceHistory || []), {
          date: new Date(),
          attended: attended,
          timestamp: new Date()
        }]
      });
      
      onUpdateAttendance(); // Refresh data
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Error updating attendance. Please try again.');
    }
  };

  // Bulk mark attendance
  const bulkMarkAttendance = async (attended) => {
    try {
      const batch = writeBatch(db);
      selectedStudents.forEach(studentId => {
        const studentRef = doc(db, 'registrations', studentId);
        const student = students.find(s => s.id === studentId);
        batch.update(studentRef, {
          attended: attended,
          lastAttendanceDate: new Date(),
          attendanceHistory: [...(student?.attendanceHistory || []), {
            date: new Date(),
            attended: attended,
            timestamp: new Date()
          }]
        });
      });
      
      await batch.commit();
      onUpdateAttendance(); // Refresh data
      setSelectedStudents(new Set());
    } catch (error) {
      console.error('Error bulk updating attendance:', error);
      alert('Error updating attendance. Please try again.');
    }
  };

  // Send bulk message
  const sendBulkMessage = async () => {
    try {
      setSending(true);
      const selectedStudentData = students.filter(student => 
        selectedStudents.has(student.id)
      );

      // Here you would integrate with your email/SMS service
      // For now, we'll just log the data and show success
      console.log('Sending message to selected students:', selectedStudentData);
      console.log('Message content:', composeData);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert(`✅ Message sent to ${selectedStudentData.length} students!`);
      setShowCompose(false);
      setComposeData({ subject: '', message: '', type: 'email' });
      setSelectedStudents(new Set());
      
    } catch (error) {
      console.error('Error sending message:', error);
      alert('❌ Error sending message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Format date safely
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      return date.toLocaleDateString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="class-student-management">
      {/* Header */}
      <div className="management-header">
        <button className="back-button" onClick={onBack}>
          ← Back to All Classes
        </button>
        <div className="class-title">
          <h3>{classData.name}</h3>
          <p>Manage student attendance and communication</p>
        </div>
        <div className="revenue-badge">
          Class Revenue: R{classRevenue.toFixed(2)}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="stats-row">
        <div className="stat-item">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="stat-item present">
          <div className="stat-number">{stats.present}</div>
          <div className="stat-label">Present</div>
        </div>
        <div className="stat-item absent">
          <div className="stat-number">{stats.absent}</div>
          <div className="stat-label">Absent</div>
        </div>
        <div className="stat-item pending">
          <div className="stat-number">{stats.pending}</div>
          <div className="stat-label">Not Marked</div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-row">
        <div className="search-filter-controls">
          <input
            type="text"
            placeholder="Search students by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Students</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="pending">Not Marked</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedStudents.size > 0 && (
          <div className="bulk-actions-bar">
            <div className="selected-info">
              {selectedStudents.size} student(s) selected
            </div>
            <div className="bulk-buttons">
              <button 
                className="btn btn-success btn-sm"
                onClick={() => bulkMarkAttendance(true)}
              >
                ✅ Mark Present
              </button>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => bulkMarkAttendance(false)}
              >
                ❌ Mark Absent
              </button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowCompose(true)}
              >
                📧 Send Message
              </button>
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedStudents(new Set())}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Students List */}
      <div className="students-list-container">
        {filteredStudents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No students found</h3>
            <p>No students match your current search or filters.</p>
          </div>
        ) : (
          <>
            <div className="list-header">
              <div className="select-all-control">
                <input
                  type="checkbox"
                  checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                  onChange={toggleSelectAll}
                  className="checkbox"
                />
                <span>Select All ({filteredStudents.length} students)</span>
              </div>
            </div>

            <div className="students-grid">
              {filteredStudents.map((student) => (
                <div key={student.id} className="student-management-card">
                  <div className="student-card-header">
                    <input
                      type="checkbox"
                      checked={selectedStudents.has(student.id)}
                      onChange={() => toggleStudentSelection(student.id)}
                      className="checkbox"
                    />
                    <div className="student-main-info">
                      <h4>{student.studentName || 'Unknown Student'}</h4>
                      <div className="student-contact">
                        <span>{student.studentEmail || 'No email'}</span>
                        <span>•</span>
                        <span>{student.studentPhone || 'No phone'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="student-details">
                    <div className="payment-info">
                      <span className="amount">Paid: R{parseFloat(student.amountPaid || 0).toFixed(2)}</span>
                      {student.approvedAt && (
                        <span className="approved-date">
                          Approved: {formatDate(student.approvedAt)}
                        </span>
                      )}
                    </div>

                    <div className="attendance-section">
                      <div className="attendance-buttons">
                        <button
                          className={`attendance-btn present ${student.attended === true ? 'active' : ''}`}
                          onClick={() => markAttendance(student.id, true)}
                          title="Mark Present"
                        >
                          ✅ Present
                        </button>
                        <button
                          className={`attendance-btn absent ${student.attended === false ? 'active' : ''}`}
                          onClick={() => markAttendance(student.id, false)}
                          title="Mark Absent"
                        >
                          ❌ Absent
                        </button>
                      </div>
                      
                      <div className="attendance-status">
                        <span className={`status ${
                          student.attended === true ? 'present' : 
                          student.attended === false ? 'absent' : 'pending'
                        }`}>
                          {student.attended === true ? 'Present' : 
                           student.attended === false ? 'Absent' : 'Not Marked'}
                        </span>
                        {student.lastAttendanceDate && (
                          <span className="last-attendance">
                            Last: {formatDate(student.lastAttendanceDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {student.attendanceHistory && student.attendanceHistory.length > 0 && (
                      <div className="attendance-history">
                        <span className="history-count">
                          {student.attendanceHistory.filter(a => a.attended).length} sessions attended
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Compose Message Modal */}
      {showCompose && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Send Message to {selectedStudents.size} Students</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCompose(false)}
                disabled={sending}
              >
                ×
              </button>
            </div>

            <div className="compose-form">
              <div className="form-group">
                <label>Message Type</label>
                <select
                  value={composeData.type}
                  onChange={(e) => setComposeData({...composeData, type: e.target.value})}
                  className="form-control"
                  disabled={sending}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>

              {composeData.type === 'email' && (
                <div className="form-group">
                  <label>Subject</label>
                  <input
                    type="text"
                    placeholder="Message subject..."
                    value={composeData.subject}
                    onChange={(e) => setComposeData({...composeData, subject: e.target.value})}
                    className="form-control"
                    disabled={sending}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Message</label>
                <textarea
                  placeholder={`Type your ${composeData.type} message here...`}
                  value={composeData.message}
                  onChange={(e) => setComposeData({...composeData, message: e.target.value})}
                  className="form-control"
                  rows="6"
                  disabled={sending}
                />
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={sendBulkMessage}
                  disabled={sending || !composeData.message.trim()}
                >
                  {sending ? (
                    <>
                      <div className="button-spinner"></div>
                      Sending...
                    </>
                  ) : (
                    `Send ${composeData.type.toUpperCase()}`
                  )}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowCompose(false)}
                  disabled={sending}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassStudentManagement;