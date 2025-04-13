import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  return (
    <div className="home">
      <h1>Welcome to Video Chat App</h1>
      <p>Connect with people who share your interests and hobbies.</p>
      <div className="buttons">
        <Link to="/signup" className="btn">Sign Up</Link>
        <Link to="/login" className="btn">Login</Link>
      </div>
    </div>
  );
};

export default Home;