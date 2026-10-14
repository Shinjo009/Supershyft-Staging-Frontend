import React, { useEffect, useMemo, useState } from 'react';
import Button from '../../components/Button';
import './ProfilePage.css';
import maleAvatar from '../../images/male-avatar.png';
import femaleAvatar from '../../images/female-avatar.png';
import editIcon from '../../images/Edit.svg';
import healthRecordsIcon from '../../images/HealthRecords.svg';
import supportIcon from '../../images/Support.svg';
import settingsIcon from '../../images/Settings.svg';
import policyIcon from '../../images/Policy.svg';
import proPhoneIcon from '../../images/Pro-Phone.svg';
import proMailIcon from '../../images/Pro-Mail.svg';
import proLocIcon from '../../images/Pro-Loc.svg';
import proGenAgeIcon from '../../images/Pro-GenAge.svg';
import { switchAccount } from '../../services/authService';
import { getMyProfile, invalidateMyProfileCache } from '../../services/profileService';
import { getMyProfiles, invalidateMyProfilesCache, unlinkMyProfile } from '../../services/usersService';
import { clearReportRequestCache, clearStoredLatestAssessmentId } from '../../services/reportService';
import { clearAuthTokens, extractTokensFromResponse, saveAuthTokens } from '../../utils/authStorage';
import { isSessionAuthError, logAuthError } from '../../utils/sessionAuth';
import { formatProfileAddressDisplay } from '../../utils/profileAddress';
import {
  isPrimaryAccountProfile,
  resolveDisplayEmail,
  resolvePrimaryLinkedProfile,
  savePrimaryAccountContact,
  shouldShowSubAccountEmail,
  shouldShowSubAccountPhone,
} from '../../utils/profilePrimaryContact';

/**
 * ProfilePage - User profile management screen
 */
const ProfilePage = ({
  onBack,
  onOpenReports,
  onOpenHealthAssessment,
  onOpenCustomerSupport,
  onOpenAllAppointments,
  onOpenAddresses,
  onOpenConsultationNotes,
  onOpenAddAccount,
  onOpenEditProfile,
  onOpenFaq,
  onOpenRateExperience,
  onOpenTerms,
  onOpenPrivacy,
  onAccountSwitched,
  onLogout,
}) => {
  const [activeModal, setActiveModal] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profile, setProfile] = useState(null);
  const [linkedProfilesLoading, setLinkedProfilesLoading] = useState(true);
  const [linkedProfilesError, setLinkedProfilesError] = useState('');
  const [linkedProfiles, setLinkedProfiles] = useState([]);
  const [switchingUserId, setSwitchingUserId] = useState(null);
  const [pendingUnlinkAccount, setPendingUnlinkAccount] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        setProfileError('');
        const response = await getMyProfile();
        const data = response?.data && typeof response.data === 'object' ? response.data : response;

        if (mounted) {
          setProfile(data);
        }
      } catch (loadError) {
        if (mounted) {
          if (isSessionAuthError(loadError)) {
            return;
          }
          logAuthError('Profile load failed', loadError);
          setProfileError('Failed to load profile. Please try again.');
        }
      } finally {
        if (mounted) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadLinkedProfiles = async () => {
      try {
        setLinkedProfilesLoading(true);
        setLinkedProfilesError('');
        const response = await getMyProfiles();
        const data = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];

        if (mounted) {
          setLinkedProfiles(data);
        }
      } catch (loadError) {
        if (mounted) {
          if (isSessionAuthError(loadError)) {
            return;
          }
          logAuthError('Linked profiles load failed', loadError);
          setLinkedProfilesError('Failed to load linked accounts. Please try again.');
        }
      } finally {
        if (mounted) {
          setLinkedProfilesLoading(false);
        }
      }
    };

    loadLinkedProfiles();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (isPrimaryAccountProfile(profile, linkedProfiles)) {
      savePrimaryAccountContact(profile);
      return;
    }

    const primaryProfile = resolvePrimaryLinkedProfile(profile, linkedProfiles);
    if (primaryProfile) {
      savePrimaryAccountContact(primaryProfile);
    }
  }, [profile, linkedProfiles]);

  const age = useMemo(() => {
    if (typeof profile?.age === 'number' && profile.age > 0) {
      return String(profile.age);
    }

    if (!profile?.date_of_birth) {
      return '';
    }

    const dob = new Date(profile.date_of_birth);
    if (Number.isNaN(dob.getTime())) {
      return '';
    }

    const today = new Date();
    let calculatedAge = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      calculatedAge -= 1;
    }

    return calculatedAge > 0 ? String(calculatedAge) : '';
  }, [profile?.age, profile?.date_of_birth]);

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || 'User';
  const phoneText = profile?.phone ? `+91 ${profile.phone}` : '-';
  const emailText = useMemo(
    () => resolveDisplayEmail(profile, linkedProfiles) || '-',
    [profile, linkedProfiles],
  );
  const locationText = formatProfileAddressDisplay(profile);
  const genderText = profile?.gender
    ? `${String(profile.gender).charAt(0).toUpperCase()}${String(profile.gender).slice(1)}`
    : '';
  const genderAgeText = [genderText, age].filter(Boolean).join(', ') || '-';
  const linkedProfilesToRender = linkedProfiles.filter((item) => Number(item?.user_id || 0) !== Number(profile?.user_id || 0));
  const isViewingSelfAccount = useMemo(
    () => isPrimaryAccountProfile(profile, linkedProfiles),
    [profile, linkedProfiles],
  );

  const shouldShowPhone = useMemo(
    () => shouldShowSubAccountPhone(profile, linkedProfiles),
    [profile, linkedProfiles],
  );

  const shouldShowEmail = useMemo(
    () => shouldShowSubAccountEmail(profile, linkedProfiles),
    [profile, linkedProfiles],
  );

  const isSwitchingProfile = switchingUserId !== null;

  const getAvatarByGender = (genderValue) => {
    const normalized = String(genderValue || '').trim().toLowerCase();
    return normalized.startsWith('f') ? femaleAvatar : maleAvatar;
  };

  const profileAvatarSrc = getAvatarByGender(profile?.gender);

  const closeModal = () => {
    setActiveModal(null);
    setLogoutLoading(false);
    setUnlinkLoading(false);
    setPendingUnlinkAccount(null);
    setError('');
  };

  const handleConfirmAction = async () => {
    if (activeModal === 'unlink') {
      try {
        const childUserId = Number(pendingUnlinkAccount?.user_id || 0);
        const unlinkPayload = childUserId > 0
          ? { child_user_id: childUserId }
          : {};

        setUnlinkLoading(true);
        setError('');
        await unlinkMyProfile(unlinkPayload);

        const response = await getMyProfiles({ forceRefresh: true });
        const data = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
        setLinkedProfiles(data);

        closeModal();
      } catch (unlinkError) {
        if (isSessionAuthError(unlinkError)) {
          return;
        }
        logAuthError('Unlink account failed', unlinkError);
        setError('Unlink failed. Please try again.');
        setUnlinkLoading(false);
      }
      return;
    }

    try {
      setLogoutLoading(true);
      setError('');
      await onLogout();
      closeModal();
    } catch (logoutError) {
      logAuthError('Logout failed', logoutError);
      setLogoutLoading(false);
    }
  };

  const handleSwitchProfile = async (targetUserId) => {
    try {
      if (profile && isPrimaryAccountProfile(profile, linkedProfiles)) {
        savePrimaryAccountContact(profile);
      }

      setSwitchingUserId(targetUserId);
      setLinkedProfilesError('');
      setProfileError('');

      const switchResponse = await switchAccount(targetUserId);
      const tokens = extractTokensFromResponse(switchResponse);

      if (!tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Switch account response missing access/refresh token.');
      }

      clearAuthTokens();
      saveAuthTokens(tokens);
      invalidateMyProfileCache();
      invalidateMyProfilesCache();
      clearReportRequestCache();
      clearStoredLatestAssessmentId();

      setProfileLoading(true);
      setLinkedProfilesLoading(true);
      setProfile(null);
      setLinkedProfiles([]);

      const [profileResponse, profilesResponse] = await Promise.all([
        getMyProfile({ forceRefresh: true }),
        getMyProfiles({ forceRefresh: true })
      ]);

      const profileData = profileResponse?.data && typeof profileResponse.data === 'object'
        ? profileResponse.data
        : profileResponse;
      const profilesData = Array.isArray(profilesResponse?.data)
        ? profilesResponse.data
        : Array.isArray(profilesResponse)
          ? profilesResponse
          : [];

      setProfile(profileData);
      setLinkedProfiles(profilesData);

      if (onAccountSwitched) {
        onAccountSwitched({
          profile: profileData,
          linkedProfiles: profilesData,
        });
      }
    } catch (switchError) {
      if (isSessionAuthError(switchError)) {
        return;
      }
      logAuthError('Switch account failed', switchError);
      setLinkedProfilesError('Failed to switch account. Please try again.');
    } finally {
      setSwitchingUserId(null);
      setProfileLoading(false);
      setLinkedProfilesLoading(false);
    }
  };

  return (
    <div className={`profile-page${isSwitchingProfile ? ' profile-page--switching' : ''}`}>
      {/* Content */}
      <div className={`profile-page__content ${activeModal ? 'profile-page__content--blurred' : ''}`}>
        {/* Back Button Header */}
        <div className="profile-page__header">
          <button
            className="profile-page__back-btn"
            onClick={onBack}
            aria-label="Go back"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="profile-page__header-title">My Profile</h1>
          <div className="profile-page__header-spacer"></div>
        </div>

        {/* Account Card */}
        <div className={`profile-page__account-card${isSwitchingProfile ? ' is-switching' : ''}`}>
          {profileLoading ? (
            <p className="profile-page__contact-item" style={{ width: '100%', justifyContent: 'center' }}>
              Loading profile...
            </p>
          ) : null}

          {!profileLoading && profileError ? (
            <p className="profile-page__contact-item" style={{ width: '100%', justifyContent: 'center', color: '#FFB3B3' }}>
              {profileError}
            </p>
          ) : null}

          <div className="profile-page__account-header">
            <div className="profile-page__avatar">
              <img src={profileAvatarSrc} alt="Profile avatar" />
            </div>
            <div className="profile-page__account-info">
              <h2 className="profile-page__full-name">{fullName}</h2>
            </div>
            <button className="profile-page__edit-btn" aria-label="Edit profile" onClick={onOpenEditProfile}>
              <img src={editIcon} alt="" aria-hidden="true" />
            </button>
          </div>

          <div className="profile-page__section-divider profile-page__section-divider--after-header" />

          <div className="profile-page__contact-list">
            {shouldShowPhone ? (
              <div className="profile-page__contact-item profile-page__contact-item--split">
                <span className="profile-page__contact-segment profile-page__contact-segment--left">
                  <img src={proPhoneIcon} alt="" aria-hidden="true" />
                  <span>{phoneText}</span>
                </span>
                <span className="profile-page__contact-segment profile-page__contact-segment--right">
                  <img src={proGenAgeIcon} alt="" aria-hidden="true" />
                  <span>{genderAgeText}</span>
                </span>
              </div>
            ) : (
              <div className="profile-page__contact-item">
                <img src={proGenAgeIcon} alt="" aria-hidden="true" />
                <span>{genderAgeText}</span>
              </div>
            )}
            {shouldShowEmail ? (
              <div className="profile-page__contact-item">
                <img src={proMailIcon} alt="" aria-hidden="true" />
                <span>{emailText}</span>
              </div>
            ) : null}
            <div className="profile-page__contact-item profile-page__contact-item--location">
              <img src={proLocIcon} alt="" aria-hidden="true" />
              <span>{locationText}</span>
            </div>
          </div>

          <div className="profile-page__section-divider profile-page__section-divider--after-contacts" />

          {!linkedProfilesLoading && !linkedProfilesError && linkedProfilesToRender.length > 0 ? (
            <div className="profile-page__accounts-title">ACCOUNTS</div>
          ) : null}

          {!linkedProfilesLoading && !linkedProfilesError && linkedProfilesToRender.length > 0 && linkedProfilesToRender.map((account) => {
            const accountName = [account?.first_name, account?.last_name].filter(Boolean).join(' ').trim() || 'User';
            const relationship = account?.relationship
              ? `${String(account.relationship).charAt(0).toUpperCase()}${String(account.relationship).slice(1)}`
              : 'Member';
            const linkedAvatarSrc = getAvatarByGender(account?.gender);
            const showUnlinkOption = isViewingSelfAccount;

            return (
              <div key={account.user_id} className={`profile-page__linked-account-row${switchingUserId === account.user_id ? ' is-switching' : ''}`}>
                <div className="profile-page__linked-account-avatar" aria-hidden="true">
                  <img src={linkedAvatarSrc} alt="" />
                </div>
                <div className="profile-page__linked-account-meta">
                  <span className="profile-page__linked-account-name">{accountName}</span>
                  <span className="profile-page__linked-account-relation">{relationship}</span>
                </div>
                <div className="profile-page__linked-account-actions">
                  <div className="profile-page__switch-cluster">
                    {showUnlinkOption ? (
                      <button
                        type="button"
                        className="profile-page__switch-link-icon"
                        aria-label="Unlink account"
                        onClick={() => {
                          setPendingUnlinkAccount(account);
                          setActiveModal('unlink');
                          setError('');
                        }}
                        disabled={unlinkLoading || switchingUserId === account.user_id}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M13.7382 10.75L17.6402 6.84803C19.0772 5.41103 19.1252 3.13003 17.7472 1.75303C16.3702 0.375032 14.0892 0.423032 12.6522 1.86003L8.75025 5.76203M10.7502 13.712L6.85824 17.592C5.42624 19.022 3.21824 19.207 1.77624 17.699C0.334245 16.192 0.450245 14.06 1.88324 12.631L5.77524 8.75003M6.75025 12.75L12.7502 6.75003" stroke="#CCCCCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`profile-page__switch-btn${switchingUserId === account.user_id ? ' is-loading' : ''}`}
                      onClick={() => handleSwitchProfile(account.user_id)}
                      disabled={switchingUserId === account.user_id}
                      data-tour="profile-switch-account"
                    >
                      {switchingUserId === account.user_id ? 'Switching...' : 'Switch'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {isViewingSelfAccount ? (
            <button className="profile-page__add-account" type="button" onClick={onOpenAddAccount} data-tour="profile-add-account">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3.75 9H14.25M9 3.75V14.25" stroke="#4B8D83" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span data-tour="profile-add-account-text">Add Account</span>
            </button>
          ) : null}
        </div>

        {/* Menu Sections */}
        <div className="profile-page__menu">
          <div className="profile-page__menu-group">
            <div className="profile-page__menu-header-static">
              <img src={healthRecordsIcon} alt="" aria-hidden="true" />
              <h2>Health Wallet</h2>
            </div>
            <div className="profile-page__menu-sub-list">
              <button type="button" className="profile-page__menu-sub-item" onClick={onOpenReports}>
                <span>Reports</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 5 8" fill="none" aria-hidden="true">
                  <path d="M0.75 6.75L3.75 3.75L0.75 0.75" stroke="#9A9A9A" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="profile-page__menu-sub-item" onClick={onOpenHealthAssessment} data-tour="profile-health-assessment">
                <span>Health Assessments</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 5 8" fill="none" aria-hidden="true">
                  <path d="M0.75 6.75L3.75 3.75L0.75 0.75" stroke="#9A9A9A" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="profile-page__menu-divider" />

          <div className="profile-page__menu-group">
            <div className="profile-page__menu-header-static">
              <img src={supportIcon} alt="" aria-hidden="true" />
              <h2>Support</h2>
            </div>
            <div className="profile-page__menu-sub-list">
              <button type="button" className="profile-page__menu-sub-item" onClick={onOpenFaq}>
                <span>FAQ's</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 5 8" fill="none" aria-hidden="true">
                  <path d="M0.75 6.75L3.75 3.75L0.75 0.75" stroke="#9A9A9A" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="profile-page__menu-sub-item" onClick={onOpenRateExperience}>
                <span>Rate Your Experience</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 5 8" fill="none" aria-hidden="true">
                  <path d="M0.75 6.75L3.75 3.75L0.75 0.75" stroke="#9A9A9A" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="profile-page__menu-sub-item" onClick={onOpenCustomerSupport}>
                <span>Customer Support</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 5 8" fill="none" aria-hidden="true">
                  <path d="M0.75 6.75L3.75 3.75L0.75 0.75" stroke="#9A9A9A" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="profile-page__menu-divider" />

          <div className="profile-page__menu-group">
            <div className="profile-page__menu-header-static">
              <img src={settingsIcon} alt="" aria-hidden="true" />
              <h2>Settings</h2>
            </div>
            <div className="profile-page__menu-sub-list">
              <button type="button" className="profile-page__menu-sub-item" onClick={onOpenAllAppointments} data-tour="profile-all-appointments">
                <span data-tour="profile-all-appointments-text">All Appointments</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 5 8" fill="none" aria-hidden="true">
                  <path d="M0.75 6.75L3.75 3.75L0.75 0.75" stroke="#9A9A9A" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="profile-page__menu-sub-item" onClick={onOpenAddresses}>
                <span>Addresses</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 5 8" fill="none" aria-hidden="true">
                  <path d="M0.75 6.75L3.75 3.75L0.75 0.75" stroke="#9A9A9A" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="profile-page__menu-sub-item" onClick={onOpenConsultationNotes} data-tour="profile-consultation-notes">
                <span data-tour="profile-consultation-notes-text">Consultation Notes</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 5 8" fill="none" aria-hidden="true">
                  <path d="M0.75 6.75L3.75 3.75L0.75 0.75" stroke="#9A9A9A" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="profile-page__menu-divider" />

          <div className="profile-page__menu-group">
            <div className="profile-page__menu-header-static">
              <img src={policyIcon} alt="" aria-hidden="true" />
              <h2>Policy</h2>
            </div>
            <div className="profile-page__menu-sub-list">
              <button type="button" className="profile-page__menu-sub-item" onClick={onOpenTerms}>
                <span>Terms &amp; Conditions</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 5 8" fill="none" aria-hidden="true">
                  <path d="M0.75 6.75L3.75 3.75L0.75 0.75" stroke="#9A9A9A" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="profile-page__menu-sub-item" onClick={onOpenPrivacy}>
                <span>Privacy Policy</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 5 8" fill="none" aria-hidden="true">
                  <path d="M0.75 6.75L3.75 3.75L0.75 0.75" stroke="#9A9A9A" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="profile-page__logout">
          <Button
            onClick={() => setActiveModal('logout')}
            icon={(
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M1.616 16C1.15533 16 0.771 15.846 0.463 15.538C0.155 15.23 0.000666667 14.8453 0 14.384V1.616C0 1.15533 0.154333 0.771 0.463 0.463C0.771667 0.155 1.156 0.000666667 1.616 0H8.019V1H1.616C1.462 1 1.32067 1.064 1.192 1.192C1.06333 1.32 0.999333 1.46133 1 1.616V14.385C1 14.5383 1.064 14.6793 1.192 14.808C1.32 14.9367 1.461 15.0007 1.615 15H8.019V16H1.616ZM12.462 11.539L11.76 10.819L14.079 8.5H5.192V7.5H14.079L11.759 5.18L12.461 4.462L16 8L12.462 11.539Z" fill="white"/>
              </svg>
            )}
          >
            Log Out
          </Button>
        </div>
      </div>

      {activeModal && (
        <div className="profile-page__modal-overlay" onClick={closeModal}>
          <div
            className="profile-page__delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="profile-page__modal-close"
              onClick={closeModal}
              aria-label="Close"
              type="button"
            >
              ×
            </button>

            {activeModal === 'unlink' ? (
              <>
                <h3 className="profile-page__modal-title">Unlink Account?</h3>
                <p className="profile-page__modal-description">
                  This linked account will be removed from your profile. You can add it again later if needed.
                </p>
              </>
            ) : (
              <>
                <h3 className="profile-page__modal-title">Log Out?</h3>
                <p className="profile-page__modal-description">
                  You will be signed out of your account. You can sign back in anytime to continue where you left off.
                </p>
              </>
            )}
            

            <div className="profile-page__modal-buttons">
              <button
                className="profile-page__modal-btn profile-page__modal-btn--no"
                type="button"
                onClick={closeModal}
              >
                NO
              </button>
              <button
                className="profile-page__modal-btn profile-page__modal-btn--yes"
                type="button"
                disabled={logoutLoading || unlinkLoading}
                onClick={handleConfirmAction}
              >
                {activeModal === 'unlink'
                  ? (unlinkLoading ? 'Unlinking...' : 'YES')
                  : (logoutLoading ? 'Logging out...' : 'YES')}
              </button>
            </div>

            {error ? (
              <p className="profile-page__modal-description" style={{ marginTop: '8px', color: '#FFB3B3' }}>
                {error}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
