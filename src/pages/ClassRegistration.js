
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';

function ClassRegistration() {
  const { businessSlug, courseSlug, venue, date } = useParams();
  const [classData, setClassData] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    paymentDate: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchClassData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let classDoc;
      
      if (businessSlug && courseSlug && venue && date) {
        const q = query(
          collection(db, 'classes'),
          where('businessSlug', '==', businessSlug),
          where('courseSlug', '==', courseSlug),
          where('venueSlug', '==', venue),
          where('dateSlug', '==', date)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          classDoc = querySnapshot.docs[0];
        }
      }

      if (classDoc) {
        const classData = { 
          id: classDoc.id, 
          ...classDoc.data(),
          price: parseFloat(classDoc.data().price) || 0
        };
        setClassData(classData);
        
        if (classData.organizationId) {
          try {
            const businessDoc = await getDoc(doc(db, 'organizations', classData.organizationId));
            if (businessDoc.exists()) {
              setBusinessData(businessDoc.data());
            } else {
              setBusinessData({
                name: classData.organizationName || 'SkillShare',
                adminName: 'Sibahle Mvubu',
                email: 'mvubusiba@gmail.com'
              });
            }
          } catch (orgError) {
            setBusinessData({
              name: classData.organizationName || 'SkillShare',
              adminName: 'Sibahle Mvubu',
              email: 'mvubusiba@gmail.com'
            });
          }
        } else {
          setBusinessData({
            name: classData.organizationName || 'SkillShare',
            adminName: 'Sibahle Mvubu',
            email: 'mvubusiba@gmail.com'
          });
        }
      } else {
        setError('Class not found. Please check your registration link.');
      }
    } catch (error) {
      console.error('Error loading class:', error);
      setError('Unable to load class information. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [businessSlug, courseSlug, venue, date]);

  useEffect(() => {
    fetchClassData();
  }, [fetchClassData]);

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) errors.name = 'Please enter your full name';
    if (!formData.email.trim()) {
      errors.email = 'Please enter your email';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.phone.trim()) errors.phone = 'Please enter your phone number';
    if (!formData.paymentDate) errors.paymentDate = 'Please select payment date';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      console.log('Starting registration submission (without POP)...');
      
      const studentId = uuidv4();

      // Simplified registration data without POP
      const registrationData = {
        classId: classData.id,
        studentId: studentId,
        studentName: formData.name.trim(),
        studentEmail: formData.email.trim(),
        studentPhone: formData.phone.trim(),
        paymentDate: formData.paymentDate,
        amountPaid: classData.price,
        status: 'pending',
        registeredAt: new Date(),
        organizationId: classData.organizationId || '',
        businessName: businessData?.name || 'SkillShare',
        adminEmail: businessData?.email || 'mvubusiba@gmail.com',
        className: classData.name,
        classPrice: classData.price,
        businessSlug,
        courseSlug,
        venueSlug: venue,
        dateSlug: date,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      console.log('Submitting registration data:', registrationData);
      
      const docRef = await addDoc(collection(db, 'registrations'), registrationData);
      console.log('Registration successful! Document ID:', docRef.id);

      setSubmitted(true);

    } catch (error) {
      console.error('Submission error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Failed to submit registration. ';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'Database permission denied. Please contact support.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'resource-exhausted') {
        errorMessage = 'Database quota exceeded. Please try again later.';
      } else {
        errorMessage += 'Please try again. If the problem continues, contact support.';
      }
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'To be announced';
    try {
      const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      return dateString;
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchClassData();
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="registration-loading">
        <div className="loading-spinner"></div>
        <p>Loading class information...</p>
      </div>
    );
  }

  if (error && !submitting) {
    return (
      <div className="registration-error">
        <div className="error-icon">⚠️</div>
        <h2>Unable to Load Registration</h2>
        <p>{error}</p>
        <div className="error-actions">
          <button onClick={handleRetry} className="btn btn-primary">
            Try Again
          </button>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-secondary"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="registration-error">
        <div className="error-icon">❌</div>
        <h2>Class Not Found</h2>
        <p>The class you're looking for doesn't exist or has been removed.</p>
        <button onClick={handleRetry} className="btn btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="class-registration">
        <div className="registration-container">
          <div className="success-page">
            <div className="success-icon">✅</div>
            <h1>Registration Complete!</h1>
            <p className="success-subtitle">Thank you for registering for {classData.name}</p>
            
            <div className="success-summary">
              <div className="summary-item">
                <strong>Student:</strong> {formData.name}
              </div>
              <div className="summary-item">
                <strong>Email:</strong> {formData.email}
              </div>
              <div className="summary-item">
                <strong>Phone:</strong> {formData.phone}
              </div>
              <div className="summary-item">
                <strong>Class:</strong> {classData.name}
              </div>
              <div className="summary-item">
                <strong>Amount Paid:</strong> R{classData.price}
              </div>
              <div className="summary-item">
                <strong>Payment Date:</strong> {new Date(formData.paymentDate).toLocaleDateString()}
              </div>
            </div>

            <div className="next-steps">
              <h3>What happens next?</h3>
              <ul>
                <li>We'll contact you within 24 hours to verify your payment</li>
                <li>Please keep your payment receipt ready</li>
                <li>You'll receive a confirmation email once payment is verified</li>
              </ul>
            </div>

            <div className="contact-info">
              <p><strong>Questions?</strong> Email {businessData?.adminName} at {businessData?.email}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="class-registration">
      <div className="registration-container">
        
        <div className="registration-header">
          <div className="header-content">
            <h6 className="business-name-test">{businessData?.name}</h6>
            <p>Complete your registration in 2 minutes</p>
          </div>
        </div>

        <div className="class-card">
          <div className="class-header">
            <h2>{classData.name}</h2>
            <div className="class-price">R{classData.price}</div>
          </div>
          <p className="class-description">{classData.description}</p>
          
          <div className="class-details">
            <div className="detail">
              <span className="icon">📅</span>
              <div>
                <div className="label">Date</div>
                <div className="value">{classData.startDate ? formatDate(classData.startDate) : 'To be announced'}</div>
              </div>
            </div>
            <div className="detail">
              <span className="icon">📍</span>
              <div>
                <div className="label">Location</div>
                <div className="value">{classData.venue || 'To be announced'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-header">
            <h3>Your Information</h3>
            <p>Fill in your details to complete registration</p>
          </div>

          {error && (
            <div className="submission-error">
              <div className="error-icon">❌</div>
              <p>{error}</p>
              <div className="error-help">
                <p><strong>Debug Info:</strong> Check browser console for detailed error information.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="registration-form">
            
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({...formData, name: e.target.value});
                  setFormErrors(prev => ({...prev, name: ''}));
                }}
                className={formErrors.name ? 'error' : ''}
                disabled={submitting}
              />
              {formErrors.name && <div className="error-message">{formErrors.name}</div>}
            </div>

            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData({...formData, email: e.target.value});
                  setFormErrors(prev => ({...prev, email: ''}));
                }}
                className={formErrors.email ? 'error' : ''}
                disabled={submitting}
              />
              {formErrors.email && <div className="error-message">{formErrors.email}</div>}
            </div>

            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                placeholder="072 123 4567"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({...formData, phone: e.target.value});
                  setFormErrors(prev => ({...prev, phone: ''}));
                }}
                className={formErrors.phone ? 'error' : ''}
                disabled={submitting}
              />
              {formErrors.phone && <div className="error-message">{formErrors.phone}</div>}
            </div>

            <div className="form-group">
              <label>Payment Date *</label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => {
                  setFormData({...formData, paymentDate: e.target.value});
                  setFormErrors(prev => ({...prev, paymentDate: ''}));
                }}
                className={formErrors.paymentDate ? 'error' : ''}
                disabled={submitting}
                max={getTodayDate()}
              />
              {formErrors.paymentDate && <div className="error-message">{formErrors.paymentDate}</div>}
            </div>

            <div className="payment-info">
              <div className="payment-header">
                <span className="icon">💳</span>
                <span>Payment Amount: R{classData.price}</span>
              </div>
              <p className="payment-instructions">
                {classData.paymentInstructions || 'Please make the payment and keep your receipt. We will contact you to verify.'}
              </p>
            </div>

            <div className="pop-note">
              <div className="note-icon">📝</div>
              <div className="note-content">
                <strong>Note about Proof of Payment:</strong>
                <p>We'll contact you after registration to verify your payment. Please keep your payment receipt ready.</p>
              </div>
            </div>

            <button 
              type="submit" 
              className={`submit-button ${submitting ? 'submitting' : ''}`}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="button-spinner"></div>
                  Submitting...
                </>
              ) : (
                'Complete Registration'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ClassRegistration;
