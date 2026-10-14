import React, { useState } from 'react';
import Typography from '../../components/Typography';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Logo from '../../components/Logo';
import AuthConsentCheckbox from '../../components/AuthConsentCheckbox';
import metfluxLogo from '../../images/metflux_logo.svg';

/**
 * LoginPage - User login with phone number
 * 
 * Props:
 * - onSuccess: Called with phone number when Send OTP is clicked
 * - onSignup: Called when Signup link is clicked
 */
const MIN_PHONE_DIGITS = 9;
const MAX_PHONE_DIGITS = 12;

const LoginPage = ({ onSuccess, onSignup }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consentGranted, setConsentGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const phoneDigitCount = phoneNumber.trim().length;
  const canSendOtp = phoneDigitCount >= MIN_PHONE_DIGITS && consentGranted;

  const handleSendOTP = async () => {
    if (canSendOtp) {
      try {
        setLoading(true);
        setError('');
        await onSuccess(phoneNumber);
      } catch (sendError) {
        setError(sendError?.message || 'Failed to send OTP. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-full px-8 pt-[75px] pb-6 flex flex-col">
      <Logo size="lg" variant="onDark" />

      <div className="mt-[105px] flex-1 flex flex-col">
        <Typography variant="heading" as="h2" align="center">
          Log In
        </Typography>

        <div className="mt-[44px] flex-1 flex flex-col">
          <Input
            type="tel"
            placeholder="Phone Number"
            maxLength={MAX_PHONE_DIGITS}
            value={phoneNumber}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '').slice(0, MAX_PHONE_DIGITS);
              setPhoneNumber(value);
            }}
          />

          <div className="mt-9">
            <AuthConsentCheckbox
              checked={consentGranted}
              onChange={setConsentGranted}
            />
          </div>

          <div className="mt-auto">
            <Button
              onClick={handleSendOTP}
              loading={loading}
              disabled={!canSendOtp}
            >
              Send OTP
            </Button>

            {error ? (
              <p className="mt-3 text-center text-[11px] text-[#FF9D9D]">{error}</p>
            ) : null}

            <div className="text-center mt-4">
              <span className="inline-flex items-center justify-center gap-1 opacity-80 text-white text-center font-lato text-[11px] font-medium leading-normal tracking-[0.05px]">
                <span>Don't have an Account?</span>
                <span
                  className="text-[13px] tracking-[0.06px] underline cursor-pointer hover:opacity-80"
                  onClick={onSignup}
                >
                  Sign Up
                </span>
              </span>
            </div>
          </div>
        </div>
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

export default LoginPage;