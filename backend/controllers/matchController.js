const User = require('../models/User');

exports.findMatch = async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId);
    const users = await User.find({ _id: { $ne: userId } });

    const matches = users.map((otherUser) => {
      const commonHobbies = user.hobbies.filter((hobby) => otherUser.hobbies.includes(hobby)).length;
      const commonInterests = user.interests.filter((interest) => otherUser.interests.includes(interest)).length;
      const matchPercentage = ((commonHobbies + commonInterests) / (user.hobbies.length + user.interests.length)) * 100;
      return { user: otherUser, matchPercentage };
    });

    const filteredMatches = matches.filter((match) => match.matchPercentage >= 60);
    res.status(200).json(filteredMatches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};