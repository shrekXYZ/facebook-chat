const VERIFY_TOKEN = "EAAkkLSTJgmcBPAJmpRYSGjzU8YDgkCYtNrt7WE5cE2HXwwc9uXyOZBlDUoYJxpPZAzqnctDCC4WPuivpFWqxwZCa12z1j0RZAj3k47CppF4sjpQ5N4TpetYwrxy5g83L9FeBZAWjbZArkBJSOZB94ujewsQQkRADN0HbQ9OmEoKFxKdjTLeBIbql1RMd6jcwROhjIYhX7b7WZA9hxxD8cbOdDwNm5kCW7ZAxINUf7x6rSOvcta7L3giryHf53Krio0gZDZD";

function webhookVerificationHandler(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
}

module.exports = webhookVerificationHandler;