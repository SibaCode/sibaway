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

  useEffect(() => {
    fetchClassData();
  }, [businessSlug, courseSlug, venue, date]);

  const fetchClassData = async () => {
    try {
      let classDoc = null;
      
      console.log('Looking for class with:', { businessSlug, courseSlug, venue, date });
      
      // Try to find by the new URL structure first
      if (businessSlug && courseSlug && venue && date) {
        const q = query(
          collection(db, 'classes'),
          where('businessSlug', '==', businessSlug),
          where('courseSlug', '==', courseSlug),
          where('venueSlug', '==', venue),
          where('dateSlug', '==', date)
        );
        const querySnapshot = await getDocs(q);
        console.log('Found classes:', querySnapshot.docs.length);
        
        if (!querySnapshot.empty) {
          classDoc = querySnapshot.docs[0];
          console.log('Class found:', classDoc.data());
        }
      }

      if (classDoc) {
        const classData = { id: classDoc.id, ...classDoc.data() };
        setClassData(classData);
        
        // Fetch business/organization data
        if (classData.organizationId) {
          console.log('Fetching business data for org:', classData.organizationId);
          try {
            const businessDoc = await getDoc(doc(db, 'organizations', classData.organizationId));
            if (businessDoc.exists()) {
              const businessData = businessDoc.data();
              console.log('Business data found:', businessData);
              setBusinessData(businessData);
            } else {
              console.log('No business document found with ID:', classData.organizationId);
              // Create fallback business data from class data
              setBusinessData({
                name: classData.organizationName || 'SkillShare',
                logo: null,
                adminName: 'Sibahle Mvubu'
              });
            }
          } catch (orgError) {
            console.error('Error fetching organization:', orgError);
            setBusinessData({
              name: classData.organizationName || 'SkillShare',
              logo: null,
              adminName: 'Sibahle Mvubu'
            });
          }
        } else {
          console.log('No organizationId in class data, using fallback');
          // Create fallback business data if no organizationId
          setBusinessData({
            name: classData.organizationName || 'SkillShare',
            logo: null,
            adminName: 'Sibahle Mvubu',
            email: 'mvubusiba@gmail.com'
          });
        }
      } else {
        console.log('No class found with the provided parameters');
        setClassData(null);
      }
    } catch (error) {
      console.error('Error fetching class:', error);
      setClassData(null);
    } finally {
      setLoading(false);
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size too large. Please select an image under 5MB.');
        return;
      }

      setPopImage(file);
      const base64 = await convertToBase64(file);
      setImagePreview(base64);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!popImage) {
      alert('Please upload proof of payment');
      return;
    }

    try {
      const popBase64 = await convertToBase64(popImage);
      const studentId = uuidv4();
      const classId = classData.id;

      const registrationData = {
        classId,
        studentId: studentId,
        studentName: formData.name,
        studentEmail: formData.email,
        studentPhone: formData.phone,
        paymentDate: formData.paymentDate,
        amountPaid: parseFloat(formData.amountPaid),
        transactionId: formData.transactionId,
        popBase64,
        popFileName: popImage.name,
        popFileType: popImage.type,
        status: 'pending',
        registeredAt: new Date(),
        organizationId: classData.organizationId,
        businessName: businessData?.name || 'SkillShare',
        adminEmail: businessData?.email || 'mvubusiba@gmail.com',
        className: classData.name,
        classDescription: classData.description,
        classPrice: classData.price
      };

      console.log('Submitting registration:', registrationData);
      await addDoc(collection(db, 'registrations'), registrationData);

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting registration:', error);
      alert('Error submitting registration. Please try again.');
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
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

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return 'TBD';
    return timeString;
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!classData) return <div className="error-message">Class not found or has been removed.</div>;

  if (submitted) {
    return (
      <div className="class-registration">
        <nav className="navbar">
          <div className="navbar-brand">
            <span>🚀 {businessData?.name || 'SkillShare'}</span>
          </div>
        </nav>
        <div className="registration-container">
          <div className="success-message" style={{textAlign: 'center', padding: '3rem'}}>
            <div className="business-branding success-branding">
              <div className="business-logo-large">
                {businessData?.logo ? (
                  <img src={businessData.logo} alt={`${businessData.name} logo`} />
                ) : (
                  <div className="logo-placeholder">🏢</div>
                )}
                <h1>{businessData?.name || 'SkillShare'}</h1>
              </div>
            </div>
            <h1>✅ Registration Submitted!</h1>
            <p>Thank you <strong>{formData.name}</strong> for registering for <strong>{classData.name}</strong>.</p>
            <p>Your payment proof has been received and is under review by <strong>{businessData?.name || 'SkillShare'}</strong>.</p>
            <p>You will receive an email at <strong>{formData.email}</strong> once your registration is approved.</p>
            <p><strong>Admin Contact:</strong> {businessData?.adminName || 'Sibahle Mvubu'} ({businessData?.email || 'mvubusiba@gmail.com'})</p>
            <button 
              onClick={() => window.location.reload()}
              className="btn btn-primary"
              style={{marginTop: '2rem'}}
            >
              Register Another Student
            </button>
          </div>
        </div>
      </div>
    );
  }

return (
  <div className="class-registration">
    <div className="registration-container">
      {/* Header */}
      <div className="registration-header">
        <div className="business-info">
          <h1 className="business-name">{businessData?.name || 'SkillShare'}</h1>
          <p className="business-subtitle">Professional Training & Education</p>
        </div>
      </div>

      {/* Class Information */}
      <div className="class-information">
        <div className="class-header">
          <h2>Class Registration</h2>
          <div className="class-title-section">
            <h1>{classData.name}</h1>
            <div className="price">${classData.price}</div>
          </div>
        </div>

        <div className="class-details">
          <div className="detail-section">
            <h3>Description</h3>
            <p>{classData.description}</p>
          </div>

          <div className="detail-section">
            <h3>Schedule & Location</h3>
            <div className="details-grid">
              {classData.startDate && (
                <div className="detail-item">
                  <span className="label">Start Date:</span>
                  <span className="value">{formatDate(classData.startDate)}</span>
                </div>
              )}
              {classData.endDate && (
                <div className="detail-item">
                  <span className="label">End Date:</span>
                  <span className="value">{formatDate(classData.endDate)}</span>
                </div>
              )}
              {classData.classTime && (
                <div className="detail-item">
                  <span className="label">Time:</span>
                  <span className="value">{formatTime(classData.classTime)}</span>
                </div>
              )}
              {classData.venue && (
                <div className="detail-item">
                  <span className="label">Venue:</span>
                  <span className="value">{classData.venue}</span>
                </div>
              )}
              {classData.schedule && (
                <div className="detail-item">
                  <span className="label">Schedule:</span>
                  <span className="value">{classData.schedule}</span>
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h3>Payment Instructions</h3>
            <p>{classData.paymentInstructions || 'Please complete your payment and upload proof of payment during registration.'}</p>
            <div className="provider-note">
              This class is provided by {businessData?.name || 'SkillShare'}
            </div>
          </div>
        </div>
      </div>

      {!showRegistrationForm ? (
        <div className="registration-cta">
          <div className="cta-content">
            <h3>Ready to Register?</h3>
            <p>Complete your registration in a few simple steps</p>
            <button 
              onClick={() => setShowRegistrationForm(true)}
              className="btn btn-primary"
            >
              Begin Registration
            </button>
            <div className="cta-features">
              <div className="feature">✓ Secure registration process</div>
              <div className="feature">✓ No account required</div>
              <div className="feature">✓ Quick confirmation</div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-section">
            <h3>Student Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Payment Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Payment Date *</label>
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Amount Paid *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amountPaid}
                  onChange={(e) => setFormData({...formData, amountPaid: e.target.value})}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Transaction ID (Optional)</label>
                <input
                  type="text"
                  placeholder="Bank reference, transaction ID, etc."
                  value={formData.transactionId}
                  onChange={(e) => setFormData({...formData, transactionId: e.target.value})}
                />
                <small>Helpful for payment verification</small>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Proof of Payment</h3>
            <div className="file-upload-group">
              <label>Upload payment receipt *</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
              />
              <small>Upload a clear image of your payment receipt (Max 5MB)</small>
              
              {imagePreview && (
                <div className="image-preview">
                  <p>Uploaded image:</p>
                  <img src={imagePreview} alt="Payment receipt preview" />
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Submit Registration
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => {
                setShowRegistrationForm(false);
                setPopImage(null);
                setImagePreview(null);
              }}
            >
              Cancel
            </button>
          </div>

          <div className="form-footer">
            <p>Your registration will be reviewed by {businessData?.name || 'SkillShare'}</p>
            <p>Contact: {businessData?.adminName || 'Sibahle Mvubu'} • {businessData?.email || 'mvubusiba@gmail.com'}</p>
          </div>
        </form>
      )}
    </div>
  </div>
);
}

export default ClassRegistration;