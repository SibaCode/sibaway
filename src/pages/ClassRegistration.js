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
  const [isMobile, setIsMobile] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    paymentDate: ''
  });
  const [popImage, setPopImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

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
    if (!popImage) errors.popImage = 'Please upload proof of payment';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Mobile-friendly file size check (smaller limit for mobile)
      const maxSize = isMobile ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setFormErrors({ popImage: `File is too large. Please select an image under ${isMobile ? '3MB' : '5MB'}.` });
        return;
      }

      if (!file.type.startsWith('image/')) {
        setFormErrors({ popImage: 'Please select an image file (JPG, PNG)' });
        return;
      }

      setPopImage(file);
      setFormErrors(prev => ({ ...prev, popImage: '' }));
      
      try {
        const base64 = await convertToBase64(file);
        setImagePreview(base64);
      } catch (error) {
        console.error('Error converting image:', error);
        setFormErrors({ popImage: 'Error uploading image. Please try again.' });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const popBase64 = await convertToBase64(popImage);
      const studentId = uuidv4();

      const registrationData = {
        classId: classData.id,
        studentId: studentId,
        studentName: formData.name.trim(),
        studentEmail: formData.email.trim(),
        studentPhone: formData.phone.trim(),
        paymentDate: formData.paymentDate,
        amountPaid: classData.price,
        popBase64,
        popFileName: popImage.name,
        popFileType: popImage.type,
        popFileSize: popImage.size,
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
        // Add device info for debugging
        userAgent: navigator.userAgent,
        isMobile: isMobile,
        timestamp: new Date().toISOString()
      };

      console.log('Submitting registration from:', isMobile ? 'Mobile' : 'Desktop');
      
      const docRef = await addDoc(collection(db, 'registrations'), registrationData);
      console.log('Registration successful, ID:', docRef.id);

      setSubmitted(true);

    } catch (error) {
      console.error('Submission error on mobile:', error);
      
      let errorMessage = 'Failed to submit registration. ';
      
      if (error.code === 'permission-denied') {
        errorMessage += 'Database permissions issue.';
      } else if (error.code === 'unavailable') {
        errorMessage += 'Network error. Please check your connection.';
      } else if (error.message.includes('Quota')) {
        errorMessage += 'File too large for mobile upload. Please try a smaller image.';
      } else {
        errorMessage += 'Please try again or contact support.';
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

  // Get today's date for max date restriction
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
        {isMobile && (
          <div className="mobile-tip">
            <p>💡 <strong>Mobile Tip:</strong> Ensure you have a stable internet connection.</p>
          </div>
        )}
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
                <strong>Class:</strong> {classData.name}
              </div>
              <div className="summary-item">
                <strong>Amount Paid:</strong> R{classData.price}
              </div>
            </div>

            <div className="next-steps">
              <h3>What happens next?</h3>
              <ul>
                <li>We'll review your payment within 24 hours</li>
                <li>You'll receive a confirmation email</li>
                <li>Keep your payment receipt safe</li>
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
        
        {/* Simple Header */}
        <div className="registration-header">
          <div className="header-content">
            <h6 className="business-name-test">{businessData?.name}</h6>
            <p>Complete your registration in 2 minutes</p>
            {/* {isMobile && (
              <div className="mobile-notice">
                📱 Mobile-friendly form
              </div>
            )} */}
          </div>
        </div>

        {/* Class Info */}
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

        {/* Simple Registration Form */}
        <div className="form-card">
          <div className="form-header">
            <h3>Your Information</h3>
            <p>Fill in your details to complete registration</p>
          </div>

          {error && (
            <div className="submission-error">
              <div className="error-icon">❌</div>
              <p>{error}</p>
              {isMobile && (
                <div className="mobile-help">
                  <p><strong>Mobile Help:</strong> Try using a smaller image or better network connection.</p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="registration-form">
            
            <div className="form-group">
              <label>Full Name</label>
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
                // Mobile-specific attributes
                inputMode="text"
                autoComplete="name"
              />
              {formErrors.name && <div className="error-message">{formErrors.name}</div>}
            </div>

            <div className="form-group">
              <label>Email Address</label>
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
                // Mobile-specific attributes
                inputMode="email"
                autoComplete="email"
              />
              {formErrors.email && <div className="error-message">{formErrors.email}</div>}
            </div>

            <div className="form-group">
              <label>Phone Number</label>
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
                // Mobile-specific attributes
                inputMode="tel"
                autoComplete="tel"
              />
              {formErrors.phone && <div className="error-message">{formErrors.phone}</div>}
            </div>

            <div className="form-group">
              <label>Payment Date</label>
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
                {classData.paymentInstructions || 'Please make payment and upload proof above.'}
              </p>
            </div>
  {isMobile && (
              <div className="mobile-tips">
                <h4>📱 Mobile Tips:</h4>
                <ul>
                  <li>Use a stable Wi-Fi connection for faster uploads</li>
                  <li>Keep image files under 3MB</li>
                  <li>Take a clear photo of your payment receipt</li>
                </ul>
              </div>
            )}
            <div className="form-group">
              <label>Proof of Payment</label>
              <div className="file-upload-section">
                <div className={`file-upload ${formErrors.popImage ? 'error' : ''} ${submitting ? 'disabled' : ''}`}>
                  <div className="upload-icon">📎</div>
                  <div className="upload-text">
                    <div className="upload-title">Upload payment proof</div>
                    <div className="upload-subtitle">
                      {isMobile ? 'Tap to take photo or select image' : 'Click to select an image file'}
                      {isMobile && <br />}(Max 3MB)
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="file-input"
                    disabled={submitting}
                    // Mobile-specific attributes
                    capture="environment" // Opens camera on mobile
                  />
                </div>
                {formErrors.popImage && <div className="error-message">{formErrors.popImage}</div>}
                
                {imagePreview && (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Payment proof" />
                    <button 
                      type="button" 
                      className="remove-image"
                      onClick={() => {
                        setPopImage(null);
                        setImagePreview(null);
                      }}
                      disabled={submitting}
                    >
                      Remove
                    </button>
                  </div>
                )}
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