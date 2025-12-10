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
  const [referenceNumber, setReferenceNumber] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });
  const [popImage, setPopImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [paymentAmount, setPaymentAmount] = useState('');

  // Generate a unique reference number
  const generateReferenceNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const classCode = classData?.name?.substring(0, 3).toUpperCase() || 'CLS';
    return `REF-${classCode}-${timestamp}-${random}`;
  };

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
        
        // Set initial payment amount to class price
        setPaymentAmount(classData.price.toString());
        
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

  const compressImage = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Image loading failed'));
      img.src = URL.createObjectURL(file);
    });
  };

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
    if (!formData.phone.trim()) errors.phone = 'Please enter your phone number';
    
    // Validate payment amount
    if (!paymentAmount.trim()) {
      errors.paymentAmount = 'Please enter the amount paid';
    } else {
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount < 0) {
        errors.paymentAmount = 'Please enter a valid amount';
      } else if (classData && amount < classData.price) {
        errors.paymentAmount = `Payment amount must be at least R${classData.price}`;
      }
    }
    
    if (!popImage) errors.popImage = 'Please upload proof of payment';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const maxSize = 4 * 1024 * 1024;
      if (file.size > maxSize) {
        setFormErrors({ popImage: 'File is too large. Please select an image under 4MB.' });
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
        console.error('Error creating preview:', error);
        setFormErrors({ popImage: 'Error loading image preview. Please try a different image.' });
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
      // Generate reference number
      const refNumber = generateReferenceNumber();
      setReferenceNumber(refNumber);
      
      let processedImage = popImage;
      let popBase64;

      try {
        processedImage = await compressImage(popImage, 600, 0.6);
      } catch (compressError) {
        console.warn('Compression failed, using original image:', compressError);
      }

      try {
        popBase64 = await convertToBase64(processedImage);
      } catch (convertError) {
        console.error('Base64 conversion failed:', convertError);
        throw new Error('IMAGE_CONVERSION_FAILED');
      }

      const studentId = uuidv4();

      // Create registration data with reference number and payment date
      const registrationData = {
        classId: classData.id,
        studentId: studentId,
        studentName: formData.name.trim(),
        studentPhone: formData.phone.trim(),
        paymentAmount: parseFloat(paymentAmount),
        amountPaid: parseFloat(paymentAmount),
        popBase64: popBase64,
        popFileName: popImage.name,
        popFileType: processedImage.type,
        popFileSize: processedImage.size,
        referenceNumber: refNumber,
        status: 'pending',
        registeredAt: new Date(),
        paymentDate: new Date(), // Payment date sent to DB but not shown to customer
        organizationId: classData.organizationId || '',
        businessName: businessData?.name || 'SkillShare',
        adminEmail: businessData?.email || 'mvubusiba@gmail.com',
        className: classData.name,
        classPrice: classData.price,
        businessSlug,
        courseSlug,
        venueSlug: venue,
        dateSlug: date
      };

      const docRef = await addDoc(collection(db, 'registrations'), registrationData);
      console.log('Registration successful! Document ID:', docRef.id, 'Reference:', refNumber);

      setSubmitted(true);

    } catch (error) {
      console.error('Submission error:', error);
      
      let errorMessage = 'Failed to submit registration. ';
      
      if (error.message === 'IMAGE_CONVERSION_FAILED') {
        errorMessage = 'Failed to process the image. Please try a different image file.';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'Database permission denied. Please contact support.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('quota') || error.code === 'resource-exhausted') {
        errorMessage = 'File is too large after processing. Please try a smaller image.';
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
            
            <div className="reference-section">
              <div className="reference-header">
                <span className="reference-icon">📋</span>
                <h3>Your Reference Number</h3>
              </div>
              <div className="reference-number">{referenceNumber}</div>
              <p className="reference-note">
                Please save this reference number for future communications.
              </p>
            </div>
            
            <div className="success-summary">
              <h4>Registration Details</h4>
              <div className="summary-item">
                <strong>Student:</strong> {formData.name}
              </div>
              <div className="summary-item">
                <strong>Class:</strong> {classData.name}
              </div>
              <div className="summary-item">
                <strong>Class Date:</strong> {classData.startDate ? formatDate(classData.startDate) : 'To be announced'}
              </div>
              <div className="summary-item">
                <strong>Amount Paid:</strong> R{paymentAmount}
              </div>
              <div className="summary-item">
                <strong>Phone:</strong> {formData.phone}
              </div>
            </div>

            <div className="next-steps">
              <h4>What happens next?</h4>
              <ul>
                <li>Your registration is now <strong>pending verification</strong></li>
                <li>We will verify your payment proof within 24-48 hours</li>
                <li>You will receive a confirmation SMS once verified</li>
                <li>Keep your reference number for any inquiries</li>
              </ul>
            </div>

            <div className="contact-info">
              <p><strong>Questions?</strong> Contact {businessData?.adminName} at {businessData?.email}</p>
              <p className="reference-display">Reference: <strong>{referenceNumber}</strong></p>
            </div>
            
            <button 
              onClick={() => window.print()} 
              className="btn btn-secondary print-btn"
            >
              Print this page
            </button>
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
            <p>Complete your registration</p>
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
                <p><strong>Tip:</strong> Try using a smaller image or better internet connection.</p>
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
              <label>Amount Paid *</label>
              <div className="amount-input-container">
                <span className="currency-prefix">R</span>
                <input
                  type="number"
                  step="0.01"
                  min={classData.price}
                  placeholder="Enter amount paid"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentAmount(e.target.value);
                    setFormErrors(prev => ({...prev, paymentAmount: ''}));
                  }}
                  className={formErrors.paymentAmount ? 'error' : ''}
                  disabled={submitting}
                />
              </div>
              {formErrors.paymentAmount && <div className="error-message">{formErrors.paymentAmount}</div>}
              <div className="amount-note">
                <span className="info-icon">ℹ️</span>
                <span>Minimum payment: R{classData.price}</span>
              </div>
            </div>

            <div className="form-group">
              <label>Proof of Payment *</label>
              <div className="file-upload-section">
                <div className={`file-upload ${formErrors.popImage ? 'error' : ''} ${submitting ? 'disabled' : ''}`}>
                  <div className="upload-icon">📎</div>
                  <div className="upload-text">
                    {/* <div className="upload-title">
                      {popImage ? `Selected: ${popImage.name}` : 'Upload payment proof'}
                    </div> */}
                    <div className="upload-subtitle">
                      {popImage ? 'Click to change file' : 'Click to select an image file (Max 4MB)'}
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="file-input"
                    disabled={submitting}
                  />
                </div>
                {formErrors.popImage && <div className="error-message">{formErrors.popImage}</div>}
                
                {imagePreview && (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Payment proof preview" />
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

            <div className="reference-info">
              <div className="info-box">
                <span className="info-icon">ℹ️</span>
                <span>A unique reference number will be generated upon submission.</span>
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