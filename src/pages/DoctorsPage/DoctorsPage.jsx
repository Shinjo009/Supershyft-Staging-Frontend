import { useEffect, useMemo, useState } from 'react';
import './DoctorsPage.css';
import { getExperts } from '../../services/expertsService';
import { isListedExpert, mapExpertRecord } from '../../utils/expertsCatalog';
import NavBar from '../../components/NavBar';
import bannerOne from '../../images/supercare/supercare-banner-1.jpg';
import bannerTwo from '../../images/supercare/supercare-banner-2.png';
import bannerThree from '../../images/supercare/supercare-banner-3.png';
import bannerFour from '../../images/supercare/supercare-banner-4.png';
import nutritionBannerOne from '../../images/supercare/nutrition/banner-1.jpg';
import nutritionBannerTwo from '../../images/supercare/nutrition/banner-2.jpg';
import nutritionBannerThree from '../../images/supercare/nutrition/banner-3.jpg';
import nutritionBannerFour from '../../images/supercare/nutrition/banner-4.png';
import ayurvedaBannerOne from '../../images/supercare/ayurveda/banner-1.jpg';
import ayurvedaBannerTwo from '../../images/supercare/ayurveda/banner-2.png';
import ayurvedaBannerThree from '../../images/supercare/ayurveda/banner-3.png';
import ayurvedaBannerFour from '../../images/supercare/ayurveda/banner-4.png';
import doctorPhoto from '../../images/supercare/supercare-doctor.jpg';
import cartIcon from '../../images/supercare/supercare-cart.svg';
import searchIcon from '../../images/supercare/supercare-search.svg';
import starIcon from '../../images/supercare/supercare-star.svg';

const TABS = ['Doctors', 'Ayurveda', 'Nutritionists', 'Packages'];

const BANNERS_BY_TAB = {
  Doctors: [bannerOne, bannerTwo, bannerThree, bannerFour],
  Ayurveda: [ayurvedaBannerOne, ayurvedaBannerTwo, ayurvedaBannerThree, ayurvedaBannerFour],
  Nutritionists: [nutritionBannerOne, nutritionBannerTwo, nutritionBannerThree, nutritionBannerFour],
};

const DoctorsPage = ({
  onBack,
  onOpenPackages,
  onNavigateToSuperClub,
  onOpenDoctorProfile,
  initialTab = 'Doctors',
}) => {
  const [activeTab, setActiveTab] = useState(
    TABS.includes(initialTab) ? initialTab : 'Doctors',
  );
  const [query, setQuery] = useState('');
  const [experts, setExperts] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    getExperts()
      .then((response) => {
        if (!active) return;
        const rows = Array.isArray(response?.data) ? response.data : [];
        setExperts(rows.map(mapExpertRecord).filter(isListedExpert));
        setLoadError('');
        setHasLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setExperts([]);
        setLoadError('Unable to load experts.');
        setHasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleExperts = useMemo(() => {
    const banners = BANNERS_BY_TAB[activeTab] || BANNERS_BY_TAB.Doctors;
    const tabExperts = experts.filter((expert) => expert.tab === activeTab);
    const normalized = query.trim().toLowerCase();
    const matched = normalized
      ? tabExperts.filter((expert) => (
        expert.name.toLowerCase().includes(normalized)
        || expert.specialty.toLowerCase().includes(normalized)
        || expert.experience.toLowerCase().includes(normalized)
      ))
      : tabExperts;
    return matched.map((expert, index) => ({
      ...expert,
      banner: banners[index % banners.length],
      bannerFit: 'cover',
    }));
  }, [activeTab, experts, query]);

  const searchPlaceholder = activeTab === 'Doctors'
    ? 'Search doctors...'
    : `Search ${activeTab.toLowerCase()}...`;

  return (
    <div className="doctors-page">
      <div className="doctors-page__scroll">
        <header className="doctors-page__header">
          <h1 className="doctors-page__title">Consult Experts</h1>
          <button type="button" className="doctors-page__cart" aria-label="Open cart">
            <img src={cartIcon} alt="" width="24" height="24" />
          </button>
        </header>

        <div className="doctors-page__filters" role="tablist" aria-label="Expert categories">
          <div className="doctors-page__filter-track">
            {TABS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`doctors-page__filter${isActive ? ' doctors-page__filter--active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab);
                    setQuery('');
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        <label className="doctors-page__search">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="doctors-page__search-input"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          <img src={searchIcon} alt="" width="13" height="13" />
        </label>

        <div className="doctors-page__list">
          {!hasLoaded ? (
            <p className="doctors-page__empty">Loading experts...</p>
          ) : null}
          {hasLoaded && loadError ? (
            <p className="doctors-page__empty">{loadError}</p>
          ) : null}
          {hasLoaded && !loadError && visibleExperts.length === 0 ? (
            <p className="doctors-page__empty">
              {activeTab === 'Packages' ? 'No packages available.' : 'No experts found.'}
            </p>
          ) : null}
          {visibleExperts.map((expert) => (
            <article key={expert.id} className="doctors-page__card">
              <div className="doctors-page__hero">
                <div className="doctors-page__banner" aria-hidden="true">
                  <img
                    src={expert.banner}
                    alt=""
                    className={expert.bannerFit ? `is-${expert.bannerFit}` : undefined}
                    style={expert.bannerFit ? undefined : { top: expert.bannerTop, height: expert.bannerHeight }}
                  />
                </div>
                {expert.rating ? (
                  <span className="doctors-page__rating">
                    <span>{expert.rating}</span>
                    <img src={starIcon} alt="" width="11.6667" height="11.0833" />
                  </span>
                ) : null}
                <div className="doctors-page__identity">
                  <span className="doctors-page__avatar">
                    <img
                      src={expert.photo || doctorPhoto}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = doctorPhoto;
                      }}
                    />
                  </span>
                  <div className="doctors-page__identity-copy">
                    <div>
                      <h2>{expert.name}</h2>
                      <p className={expert.specialtyStrong ? 'is-strong' : undefined}>{expert.specialty}</p>
                    </div>
                    {expert.experience ? <span>{expert.experience}</span> : null}
                  </div>
                </div>
              </div>

              <div className="doctors-page__body">
                <div className="doctors-page__stats">
                  {expert.availability ? (
                    <div>
                      <strong>{expert.availability}</strong>
                      <span>AVAILABILITY</span>
                    </div>
                  ) : null}
                  {expert.consultation ? (
                    <div>
                      <strong>{expert.consultation}</strong>
                      <span>CONSULTATION</span>
                    </div>
                  ) : null}
                  {expert.duration ? (
                    <div>
                      <strong>{expert.duration}</strong>
                      <span>DURATION</span>
                    </div>
                  ) : null}
                </div>
                <div className="doctors-page__price-row">
                  <div className="doctors-page__price">
                    <div className="doctors-page__price-top">
                      <strong>{expert.price}</strong>
                      {expert.discount ? <span>{expert.discount}</span> : null}
                    </div>
                    {expert.priceOld ? <s>{expert.priceOld}</s> : null}
                  </div>
                  <button
                    type="button"
                    className="doctors-page__profile"
                    onClick={() => onOpenDoctorProfile?.(expert)}
                  >
                    View Profile
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <NavBar
        defaultActive="super-sync"
        onNavigate={(itemId) => {
          if (itemId === 'home') {
            onBack();
          }
          if (itemId === 'packages') {
            if (onOpenPackages) {
              onOpenPackages();
            }
          }
          if (itemId === 'super-club' && onNavigateToSuperClub) {
            onNavigateToSuperClub();
          }
        }}
      />
    </div>
  );
};

export default DoctorsPage;
