import {
  faCalendarDays,
  faCircleUser,
  faGear,
  faHourglassHalf,
} from '@fortawesome/free-solid-svg-icons';
import {
  faCalendarDays as faCalendarDaysRegular,
  faCircleUser as faCircleUserRegular,
} from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { NavLink } from 'react-router-dom';
import style from './Navbar.module.css';

export function Navbar() {
  return (
    <nav className={`navbar ${style.navbar}`}>
      <div className="logo">
        <FontAwesomeIcon icon={faHourglassHalf} size="3x" />
      </div>
      <div className={style.spacer} />
      <NavLink className="nav-link" to="/">
        {({ isActive }) => (
          <>
            <FontAwesomeIcon
              icon={isActive ? faCalendarDays : faCalendarDaysRegular}
              size="3x"
            />
            <span>Time Sheet</span>
          </>
        )}
      </NavLink>
      <div className={style.spacer} />
      <NavLink className="nav-link" to="/profile">
        {({ isActive }) => (
          <>
            <FontAwesomeIcon
              icon={isActive ? faCircleUser : faCircleUserRegular}
              size="3x"
            />
            <span>Elias Mjøen</span>
          </>
        )}
      </NavLink>
      <NavLink className="nav-link" to="/settings">
        <>
          <FontAwesomeIcon icon={faGear} size="3x" />
          <span>Settings</span>
        </>
      </NavLink>
    </nav>
  );
}

export default Navbar;
