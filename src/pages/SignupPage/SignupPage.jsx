import React, { useState } from 'react';
import Typography from '../../components/Typography';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Logo from '../../components/Logo';
import AuthConsentCheckbox from '../../components/AuthConsentCheckbox';
import metfluxLogo from '../../images/metflux_logo.svg';

const MaleIcon = ({ active }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path d="M12.0006 0H9.00064C8.86803 0 8.74085 0.0526785 8.64708 0.146447C8.55332 0.240215 8.50064 0.367392 8.50064 0.5C8.50064 0.632608 8.55332 0.759785 8.64708 0.853553C8.74085 0.947321 8.86803 1 9.00064 1H10.7938L8.16439 3.62937C7.17121 2.81754 5.904 2.41848 4.62485 2.51473C3.3457 2.61098 2.15248 3.19517 1.29196 4.14647C0.431439 5.09778 -0.0305406 6.34343 0.00156826 7.62579C0.0336771 8.90815 0.557418 10.1291 1.46447 11.0362C2.37152 11.9432 3.59249 12.467 4.87485 12.4991C6.15721 12.5312 7.40286 12.0692 8.35417 11.2087C9.30547 10.3482 9.88966 9.15493 9.98591 7.87579C10.0822 6.59664 9.68309 5.32943 8.87126 4.33625L11.5006 1.7075V3.5C11.5006 3.63261 11.5533 3.75979 11.6471 3.85355C11.7409 3.94732 11.868 4 12.0006 4C12.1332 4 12.2604 3.94732 12.3542 3.85355C12.448 3.75979 12.5006 3.63261 12.5006 3.5V0.5C12.5006 0.367392 12.448 0.240215 12.3542 0.146447C12.2604 0.0526785 12.1332 0 12.0006 0ZM7.82814 10.3306C7.26866 10.8899 6.55592 11.2706 5.78005 11.4248C5.00417 11.579 4.2 11.4997 3.4692 11.1969C2.7384 10.8941 2.11379 10.3814 1.67434 9.72366C1.2349 9.0659 1.00035 8.29261 1.00035 7.50156C1.00035 6.71051 1.2349 5.93723 1.67434 5.27947C2.11379 4.62171 2.7384 4.10902 3.4692 3.80622C4.2 3.50341 5.00417 3.42409 5.78005 3.57829C6.55592 3.73249 7.26866 4.11327 7.82814 4.6725C8.57714 5.42351 8.99776 6.44089 8.99776 7.50156C8.99776 8.56223 8.57714 9.57962 7.82814 10.3306Z" fill={active ? '#E6E6E6' : '#9A9A9A'} />
  </svg>
);

const FemaleIcon = ({ active }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M5 0.99994C3.93913 0.99994 2.92172 1.42137 2.17157 2.17151C1.42143 2.92166 1 3.93907 1 4.99994C1 6.06081 1.42143 7.07822 2.17157 7.82837C2.92172 8.57851 3.93913 8.99994 5 8.99994C6.06087 8.99994 7.07828 8.57851 7.82843 7.82837C8.57857 7.07822 9 6.06081 9 4.99994C9 3.93907 8.57857 2.92166 7.82843 2.17151C7.07828 1.42137 6.06087 0.99994 5 0.99994ZM3.95006e-10 4.99994C1.21561e-05 4.03235 0.280771 3.08556 0.808227 2.27438C1.33568 1.4632 2.08717 0.822483 2.97156 0.429945C3.85594 0.0374067 4.83523 -0.0900927 5.79064 0.0629099C6.74605 0.215912 7.63655 0.642844 8.35413 1.29192C9.0717 1.94101 9.58553 2.78435 9.8333 3.71968C10.0811 4.655 10.0521 5.64213 9.74997 6.56133C9.44783 7.48053 8.88547 8.29232 8.13109 8.89824C7.37672 9.50416 6.46274 9.87818 5.5 9.97494V11.9999H7.5C7.63261 11.9999 7.75979 12.0526 7.85355 12.1464C7.94732 12.2402 8 12.3673 8 12.4999C8 12.6325 7.94732 12.7597 7.85355 12.8535C7.75979 12.9473 7.63261 12.9999 7.5 12.9999H5.5V15.4999C5.5 15.6325 5.44732 15.7597 5.35355 15.8535C5.25979 15.9473 5.13261 15.9999 5 15.9999C4.86739 15.9999 4.74021 15.9473 4.64645 15.8535C4.55268 15.7597 4.5 15.6325 4.5 15.4999V12.9999H2.5C2.36739 12.9999 2.24021 12.9473 2.14645 12.8535C2.05268 12.7597 2 12.6325 2 12.4999C2 12.3673 2.05268 12.2402 2.14645 12.1464C2.24021 12.0526 2.36739 11.9999 2.5 11.9999H4.5V9.97494C3.26668 9.85099 2.12337 9.27335 1.29188 8.35408C0.460384 7.43482 -1.55717e-05 6.23947 3.95006e-10 4.99994Z" fill={active ? '#E6E6E6' : '#9A9A9A'} />
  </svg>
);

const PhoneFieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M9.6908 11.4692C9.96732 11.5962 10.2949 11.5144 10.4793 11.2723L10.71 10.97C10.9555 10.6427 11.3408 10.45 11.75 10.45H13.7C14.418 10.45 15 11.032 15 11.75V13.7C15 14.418 14.418 15 13.7 15C7.23827 15 2 9.76173 2 3.3C2 2.58203 2.58203 2 3.3 2H5.25C5.96797 2 6.55 2.58203 6.55 3.3V5.25C6.55 5.65918 6.35735 6.04449 6.03 6.29L5.7258 6.51815C5.47976 6.70602 5.40035 7.04134 5.536 7.3196C6.42434 9.12391 7.88538 10.5831 9.6908 11.4692" stroke="#9A9A9A" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SelectGenderHeadingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8.00091 4.37916C8.65663 4.90515 9.12998 5.62434 9.35374 6.43463C9.57749 7.24491 9.54029 8.10509 9.24741 8.89303C8.95452 9.68097 8.42085 10.3566 7.72216 10.824C7.02348 11.2914 6.1953 11.5268 5.35522 11.4968C4.51515 11.4668 3.70588 11.1729 3.04233 10.6568C2.37879 10.1407 1.89469 9.42873 1.65879 8.6219C1.42288 7.81507 1.44716 6.95442 1.72818 6.16217C2.00919 5.36992 2.53266 4.68634 3.22425 4.2085M5.50091 11.4998V15.4998" stroke="#999999" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6.42267 9.216C5.82278 8.71035 5.38484 8.03944 5.16336 7.28678C4.94187 6.53412 4.94662 5.73294 5.17702 4.98296C5.40741 4.23298 5.85327 3.56731 6.45911 3.0688C7.06495 2.5703 7.80402 2.26096 8.58433 2.1793C9.36464 2.09764 10.1517 2.24726 10.8477 2.60954C11.5436 2.97181 12.1176 3.53075 12.4983 4.21678C12.8789 4.90281 13.0495 5.68565 12.9886 6.46786C12.9278 7.25006 12.6382 7.9971 12.156 8.616M11.8287 3.328L14.5 0.5M14.5 0.5H12M14.5 0.5V3M3.5 13.5H7.5" stroke="#999999" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const REQUIRED_FIELD = 'Required Field';
const INVALID_FORMAT = 'Invalid Format';
const FIELD_REQUIRED = 'Field Required';

const RE_NAME = /^(?=.*[a-zA-Z])[a-zA-Z\s'-]{1,60}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PHONE = /^\d{9,12}$/;
const RE_CITY = /^(?=.*[a-zA-Z])[a-zA-Z\s,.'-]{1,100}$/;
/** Integers 1–99 only */
const RE_AGE = /^([1-9]|[1-8][0-9]|9[0-9])$/;

const requiredOrInvalidFormat = (value, pattern) => {
  const t = String(value).trim();
  if (!t) return REQUIRED_FIELD;
  if (!pattern.test(t)) return INVALID_FORMAT;
  return null;
};

const validateSignupForm = (data) => {
  const errors = {};
  const set = (key, msg) => {
    if (msg) errors[key] = msg;
  };
  set('firstName', requiredOrInvalidFormat(data.firstName, RE_NAME));
  set('lastName', requiredOrInvalidFormat(data.lastName, RE_NAME));
  set('email', requiredOrInvalidFormat(data.email, RE_EMAIL));
  set('phone', requiredOrInvalidFormat(data.phone, RE_PHONE));
  set('city', requiredOrInvalidFormat(data.city, RE_CITY));
  set('age', requiredOrInvalidFormat(data.age, RE_AGE));
  if (!data.gender) {
    errors.gender = FIELD_REQUIRED;
  }
  if (!data.consentGranted) {
    errors.consent = FIELD_REQUIRED;
  }
  return errors;
};

const clearFieldError = (setFieldErrors, field) => {
  setFieldErrors((prev) => {
    if (!prev[field]) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  });
};

/**
 * SignupPage - User registration with personal details
 * 
 * Props:
 * - onSuccess: Called when Send OTP is clicked
 * - onLogin: Called when user clicks "Log in" to go back to login page
 */
const SignupPage = ({ onSuccess, onLogin }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    age: '',
    gender: '',
    consentGranted: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === 'age' ? value.replace(/\D/g, '').slice(0, 2) : value;
    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));
    clearFieldError(setFieldErrors, name);
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 12);
    setFormData(prev => ({
      ...prev,
      phone: value
    }));
    clearFieldError(setFieldErrors, 'phone');
  };

  const handleGenderChange = (gender) => {
    setFormData(prev => ({
      ...prev,
      gender
    }));
    clearFieldError(setFieldErrors, 'gender');
  };

  const handleSendOTP = async () => {
    const validation = validateSignupForm(formData);
    setFieldErrors(validation);
    if (Object.keys(validation).length > 0) {
      return;
    }
    try {
      setLoading(true);
      setError('');
      await onSuccess(formData);
    } catch (sendError) {
      setError(sendError?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-full px-6 pt-[75px] pb-6 flex flex-col">
      <Logo size="lg" variant="onDark" />

      <div className="mt-5">
        <Typography variant="heading" as="h2" align="center">
          Signup
        </Typography>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="firstName"
              type="text"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleInputChange}
              error={fieldErrors.firstName}
              className="!text-[13px] !leading-[13px] placeholder:!text-[13px] placeholder:!leading-[13px]"
            />
            <Input
              name="lastName"
              type="text"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleInputChange}
              error={fieldErrors.lastName}
              className="!text-[13px] !leading-[13px] placeholder:!text-[13px] placeholder:!leading-[13px]"
            />
          </div>

          <Input
            name="email"
            type="email"
            placeholder="Email Id"
            value={formData.email}
            onChange={handleInputChange}
            error={fieldErrors.email}
            className="!text-[13px] !leading-[13px] placeholder:!text-[13px] placeholder:!leading-[13px]"
          />

          <div className="w-full space-y-1">
            <div
              className={
                fieldErrors.phone
                  ? 'flex self-stretch w-full h-10 box-border px-[15px] py-[10px] rounded-lg border border-[#E95D5C] bg-input-bg items-center shadow-[0_0_10px_0_rgba(233,93,92,0.30)] focus-within:border-[#E95D5C] focus-within:shadow-[0_0_10px_0_rgba(233,93,92,0.30)] transition-all'
                  : 'flex self-stretch w-full h-10 box-border px-[15px] py-[10px] rounded-lg border border-transparent bg-input-bg items-center focus-within:border-white/20 focus-within:shadow-[0_0_10px_0_rgba(144,223,158,0.30)] transition-all'
              }
            >
              <span className="flex-1 min-w-0 flex items-center gap-[6px]">
                <span className="pointer-events-none inline-flex items-center justify-center">
                  <PhoneFieldIcon />
                </span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className="flex-1 min-w-0 bg-transparent text-white !text-[13px] !leading-[13px] placeholder:text-label-gray placeholder:!text-[13px] placeholder:!leading-[13px] font-lato focus:outline-none"
                />
              </span>
            </div>
            {fieldErrors.phone ? (
              <Typography variant="label" className="!text-[10px] !leading-[14px] text-[#E95D5C]">
                {fieldErrors.phone}
              </Typography>
            ) : null}
          </div>

          <Input
            name="city"
            type="text"
            placeholder="City"
            value={formData.city}
            onChange={handleInputChange}
            error={fieldErrors.city}
            className="!text-[13px] !leading-[13px] placeholder:!text-[13px] placeholder:!leading-[13px]"
          />

          <Input
            name="age"
            type="text"
            inputMode="numeric"
            maxLength={2}
            placeholder="Age"
            value={formData.age}
            onChange={handleInputChange}
            error={fieldErrors.age}
            className="!text-[13px] !leading-[13px] placeholder:!text-[13px] placeholder:!leading-[13px]"
          />

          <div className="space-y-1">
            <div className="flex items-center gap-[6px]">
              <SelectGenderHeadingIcon />
              <Typography variant="label" as="label" className="!text-[13px] !leading-[13px]">Select Gender</Typography>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleGenderChange('male')}
                className={`flex h-10 px-[10px] justify-center items-center content-center gap-y-[5px] gap-x-[10px] flex-1 flex-wrap rounded-lg ${
                  formData.gender === 'male'
                    ? 'text-white bg-[radial-gradient(50.74%_50.76%_at_50%_50%,#11795F_0%,#1C493D_100%)]'
                    : 'text-[#9A9A9A] bg-input-bg'
                }`}
              >
                <MaleIcon active={formData.gender === 'male'} />
                <span className="font-lato !text-[13px] !leading-[13px]">Male</span>
              </button>

              <button
                type="button"
                onClick={() => handleGenderChange('female')}
                className={`flex h-10 px-[10px] justify-center items-center content-center gap-y-[5px] gap-x-[10px] flex-1 flex-wrap rounded-lg ${
                  formData.gender === 'female'
                    ? 'text-white bg-[radial-gradient(50.74%_50.76%_at_50%_50%,#11795F_0%,#1C493D_100%)]'
                    : 'text-[#9A9A9A] bg-input-bg'
                }`}
              >
                <FemaleIcon active={formData.gender === 'female'} />
                <span className="font-lato !text-[13px] !leading-[13px]">Female</span>
              </button>
            </div>
            {fieldErrors.gender ? (
              <Typography variant="label" className="!text-[10px] !leading-[14px] text-[#E95D5C]">
                {fieldErrors.gender}
              </Typography>
            ) : null}
          </div>

          <AuthConsentCheckbox
            checked={formData.consentGranted}
            error={fieldErrors.consent}
            onChange={(consentGranted) => {
              setFormData((prev) => ({ ...prev, consentGranted }));
              clearFieldError(setFieldErrors, 'consent');
            }}
          />

          <div>
            <Button onClick={handleSendOTP} loading={loading}>
              Continue
            </Button>
          </div>

          {error ? (
            <p className="text-center text-[11px] text-[#FF9D9D]">{error}</p>
          ) : null}
        </div>
      </div>

      <div className="text-center mt-4">
        <span className="inline-flex items-center justify-center gap-1 opacity-80 text-white text-center font-lato text-[11px] font-medium leading-normal tracking-[0.05px]">
          <span>Already have an Account?</span>
          <span
            className="text-[13px] tracking-[0.06px] underline cursor-pointer hover:opacity-80"
            onClick={onLogin}
          >
            Log In
          </span>
        </span>
      </div>

      <div className="mt-auto flex flex-col items-center gap-1 pb-1">
        <span className="font-lato text-[8px] font-light leading-none tracking-[0.04px] text-[#CCC] opacity-80 text-center">
          Powered by
        </span>
        <img
          src={metfluxLogo}
          alt="MetFlux Research"
          className="w-[60px] h-[22px]"
          style={{ aspectRatio: '30 / 11' }}
        />
      </div>
    </div>
  );
};

export default SignupPage;
