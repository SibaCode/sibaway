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
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    paymentDate: '',
    amountPaid: '',
    transactionId: ''
  });
  const [popImage, setPopImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Fix: Use useCallback to prevent infinite re-renders
  const fetchClassData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let classDoc;
      
      console.log('Fetching class data with:', { businessSlug, courseSlug, venue, date });
      
      // Find class by URL parameters
      if (businessSlug && courseSlug && venue && date) {
        const q = query(
          collection(db, 'classes'),
          where('businessSlug', '==', businessSlug),
          where('courseSlug', '==', courseSlug),
          where('venueSlug', '==', venue),
          where('dateSlug', '==', date)
        );
        const querySnapshot = await getDocs(q);
        
        console.log('Query results:', querySnapshot.docs.length);
        
        if (!querySnapshot.empty) {
          classDoc = querySnapshot.docs[0];
        }
      }

      if (classDoc) {
        const classData = { id: classDoc.id, ...classDoc.data() };
        console.log('Class data found:', classData);
        setClassData(classData);
        
        // Fetch business data
        if (classData.organizationId) {
          try {
            console.log('Fetching organization:', classData.organizationId);
            const businessDoc = await getDoc(doc(db, 'organizations', classData.organizationId));
            if (businessDoc.exists()) {
              const businessData = businessDoc.data();
              console.log('Business data found:', businessData);
              setBusinessData(businessData);
            } else {
              console.log('Organization not found, using fallback');
              setBusinessData({
                name: classData.organizationName || 'SkillShare',
                adminName: 'Sibahle Mvubu',
                email: 'mvubusiba@gmail.com'
              });
            }
          } catch (orgError) {
            console.error('Error fetching organization:', orgError);
            setBusinessData({
              name: classData.organizationName || 'SkillShare',
              adminName: 'Sibahle Mvubu',
              email: 'mvubusiba@gmail.com'
            });
          }
        } else {
          console.log('No organizationId, using fallback');
          setBusinessData({
            name: classData.organizationName || 'SkillShare',
            adminName: 'Sibahle Mvubu',
            email: 'mvubusiba@gmail.com'
          });
        }
      } else {
        console.log('No class document found');
        setError('Class not found. The class may have been removed or the link is incorrect.');
      }
    } catch (error) {
      console.error('Error fetching class:', error);
      setError('Unable to load class information. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [businessSlug, courseSlug, venue, date]); // Add dependencies

  // Fix: Proper useEffect with dependencies
  useEffect(() => {
    console.log('useEffect triggered');
    fetchClassData();
  }, [fetchClassData]); // Only depend on fetchClassData

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
    
    if (!formData.name.trim()) errors.name = 'Full name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.phone.trim()) errors.phone = 'Phone number is required';
    if (!formData.paymentDate) errors.paymentDate = 'Payment date is required';
    if (!formData.amountPaid || parseFloat(formData.amountPaid) <= 0) {
      errors.amountPaid = 'Please enter a valid amount';
    }
    if (!popImage) errors.popImage = 'Proof of payment is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors({ popImage: 'File size too large. Please select an image under 5MB.' });
        return;
      }

      if (!file.type.startsWith('image/')) {
        setFormErrors({ popImage: 'Please select an image file (JPG, PNG, etc.)' });
        return;
      }

      setPopImage(file);
      setFormErrors(prev => ({ ...prev, popImage: '' }));
      
      try {
        const base64 = await convertToBase64(file);
        setImagePreview(base64);
      } catch (error) {
        setFormErrors({ popImage: 'Error processing image. Please try another file.' });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

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
        amountPaid: parseFloat(formData.amountPaid),
        transactionId: formData.transactionId.trim(),
        popBase64,
        popFileName: popImage.name,
        popFileType: popImage.type,
        status: 'pending',
        registeredAt: new Date(),
        organizationId: classData.organizationId,
        businessName: businessData?.name || 'SkillShare',
        adminEmail: businessData?.email || 'mvubusiba@gmail.com',
        className: classData.name,
        classPrice: classData.price
      };

      console.log('Submitting registration:', registrationData);
      await addDoc(collection(db, 'registrations'), registrationData);
      setSubmitted(true);

    } catch (error) {
      console.error('Error submitting registration:', error);
      setError('Failed to submit registration. Please check your connection and try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'To be announced';
    try {
      const date = new Date(dateString);
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

  const formatTime = (timeString) => {
    if (!timeString) return 'To be announced';
    return timeString;
  };

  // Add a simple retry function
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

  if (error) {
    return (
      <div className="registration-error">
        <div className="error-icon">⚠️</div>
        <h2>Unable to Load Registration</h2>
        <p>{error}</p>
        <button onClick={handleRetry} className="btn btn-primary">
          Try Again
        </button>
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
            <div className="success-icon">✓</div>
            <h1>Registration Submitted Successfully</h1>
            
            <div className="success-details">
              <div className="detail-card">
                <h3>Registration Details</h3>
                <p><strong>Student:</strong> {formData.name}</p>
                <p><strong>Class:</strong> {classData.name}</p>
                <p><strong>Email:</strong> {formData.email}</p>
                <p><strong>Reference ID:</strong> {uuidv4().slice(0, 8).toUpperCase()}</p>
              </div>
              
              <div className="next-steps">
                <h3>What Happens Next?</h3>
                <ul>
                  <li>Your registration is now under review</li>
                  <li>{businessData?.name} will verify your payment</li>
                  <li>You'll receive a confirmation email within 24 hours</li>
                  <li>Keep your payment receipt for reference</li>
                </ul>
              </div>
            </div>

            <div className="contact-reminder">
              <p>
                <strong>Questions?</strong> Contact {businessData?.adminName} at {' '}
                <a href={`mailto:${businessData?.email || 'mvubusiba@gmail.com'}`}>
                  {businessData?.email || 'mvubusiba@gmail.com'}
                </a>
              </p>
            </div>

            <div className="success-actions">
              <button 
                onClick={() => window.location.reload()}
                className="btn btn-primary"
              >
                Register Another Student
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Simplified return for the main form - remove complex styling that might cause issues
  return (
    <div className="class-registration">
      <div className="registration-container">
        {/* Simple Header */}
        <header className="registration-header">
          <h1>{businessData?.name || 'SkillShare'}</h1>
          <p>Class Registration</p>
        </header>

        {/* Class Information */}
        <section className="class-information">
          <h2>{classData.name}</h2>
          <div className="price">${classData.price}</div>
          <p>{classData.description}</p>

          <div className="class-details">
            <h3>Class Details</h3>
            {classData.startDate && (
              <p><strong>Start Date:</strong> {formatDate(classData.startDate)}</p>
            )}
            {classData.endDate && (
              <p><strong>End Date:</strong> {formatDate(classData.endDate)}</p>
            )}
            {classData.classTime && (
              <p><strong>Time:</strong> {formatTime(classData.classTime)}</p>
            )}
            {classData.venue && (
              <p><strong>Location:</strong> {classData.venue}</p>
            )}
          </div>

          <div className="payment-info">
            <h3>Payment Instructions</h3>
            <p>{classData.paymentInstructions || 'Please complete your payment before registration.'}</p>
          </div>
        </section>

        {/* Registration CTA or Form */}
        {!showRegistrationForm ? (
          <section className="registration-cta">
            <button 
              onClick={() => setShowRegistrationForm(true)}
              className="btn btn-primary"
            >
              Register Now
            </button>
            <p>Simple registration process - no account needed</p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="registration-form">
            <h3>Student Registration</h3>

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({...formData, name: e.target.value});
                  setFormErrors(prev => ({...prev, name: ''}));
                }}
                className={formErrors.name ? 'error' : ''}
              />
              {formErrors.name && <span className="error-message">{formErrors.name}</span>}
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({...formData, email: e.target.value});
                  setFormErrors(prev => ({...prev, email: ''}));
                }}
                className={formErrors.email ? 'error' : ''}
              />
              {formErrors.email && <span className="error-message">{formErrors.email}</span>}
            </div>

            <div className="form-group">
              <label>Phone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({...formData, phone: e.target.value});
                  setFormErrors(prev => ({...prev, phone: ''}));
                }}
                className={formErrors.phone ? 'error' : ''}
              />
              {formErrors.phone && <span className="error-message">{formErrors.phone}</span>}
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
              />
              {formErrors.paymentDate && <span className="error-message">{formErrors.paymentDate}</span>}
            </div>

            <div className="form-group">
              <label>Amount Paid *</label>
              <input
                type="number"
                step="0.01"
                value={formData.amountPaid}
                onChange={(e) => {
                  setFormData({...formData, amountPaid: e.target.value});
                  setFormErrors(prev => ({...prev, amountPaid: ''}));
                }}
                className={formErrors.amountPaid ? 'error' : ''}
              />
              {formErrors.amountPaid && <span className="error-message">{formErrors.amountPaid}</span>}
            </div>

            <div className="form-group">
              <label>Proof of Payment *</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
              {formErrors.popImage && <span className="error-message">{formErrors.popImage}</span>}
              {imagePreview && (
                <div className="file-preview">
                  <img src={imagePreview} alt="Preview" style={{maxWidth: '200px'}} />
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Submit Registration
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowRegistrationForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ClassRegistration;