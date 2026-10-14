import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './navbar2.css';
import NavItem2 from './NavItem2';
import homeIcon from '../../images/home.svg';
import homeIconUnfilled from '../../images/Home unfilled.svg';
import superCareIcon from '../../images/SuperCare.svg';
import superCareIconUnfilled from '../../images/Super care unfilled.svg';
import superClubIcon from '../../images/SuperClub.svg';
import superClubIconUnfilled from '../../images/Super club unfilled.svg';
import packagesIcon from '../../images/Packages.svg';
import packagesIconUnfilled from '../../images/Packages unfilled.svg';
import { prefetchRouteChunk } from '../../utils/routePrefetch';

/**
 * Bottom navigation — compact active cell (10px 12px 6px), gap 3px,
 * border-top indicator, flex column centered. Icons share one rail size (see navbar2.css).
 *
 * Props: `defaultActive`, `onNavigate`.
 */
export default function NavBar2({ defaultActive = 'home', onNavigate }) {
  const navItems = useMemo(
    () => [
      {
        id: 'home',
        label: 'Home',
        iconFilled: homeIcon,
        iconUnfilled: homeIconUnfilled,
      },
      {
        id: 'packages',
        label: 'Packages',
        iconFilled: packagesIcon,
        iconUnfilled: packagesIconUnfilled,
      },
      {
        id: 'super-club',
        label: 'Super Club',
        iconFilled: superClubIcon,
        iconUnfilled: superClubIconUnfilled,
      },
      {
        id: 'super-sync',
        label: 'Super Care',
        iconFilled: superCareIcon,
        iconUnfilled: superCareIconUnfilled,
      },
    ],
    []
  );

  const [activeItem, setActiveItem] = useState(defaultActive);
  const prevDefaultActiveRef = useRef(null);

  useLayoutEffect(() => {
    if (prevDefaultActiveRef.current === defaultActive) {
      return;
    }
    prevDefaultActiveRef.current = defaultActive;
    setActiveItem(defaultActive);
  }, [defaultActive]);

  const handleItemIntent = useCallback(
    (id) => {
      const item = navItems.find((entry) => entry.id === id);
      if (item?.locked) {
        return;
      }
      prefetchRouteChunk(id);
    },
    [navItems],
  );

  const handleItemClick = useCallback(
    (id) => {
      const clicked = navItems.find((item) => item.id === id);
      if (clicked?.locked) {
        return;
      }

      prefetchRouteChunk(id);

      if (id === activeItem) {
        onNavigate?.(id);
        return;
      }

      setActiveItem(id);
      onNavigate?.(id);
    },
    [activeItem, navItems, onNavigate]
  );

  return (
    <nav className="navbar2" aria-label="Main navigation">
      <div className="navbar2__glow">
        <div className="navbar2__bar">
          <div className="navbar2__rail">
            {navItems.map((item) => (
              <NavItem2
                key={item.id}
                id={item.id}
                label={item.label}
                iconFilled={item.iconFilled}
                iconUnfilled={item.iconUnfilled}
                locked={Boolean(item.locked)}
                isActive={activeItem === item.id}
                onClick={handleItemClick}
                onIntent={handleItemIntent}
              />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
