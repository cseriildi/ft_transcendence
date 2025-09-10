import './router/Router.js';

console.log("Hello, TypeScript!");

const initHomePage = () => {
  const pongBtn = document.getElementById('pong-btn');
  const authBtn = document.getElementById('auth-btn');
  
  pongBtn?.addEventListener('click', () => router.navigate('/pong'));
  authBtn?.addEventListener('click', () => router.navigate('/auth'));
};

const initPongPage = () => {
  const backBtn = document.getElementById('back-btn');
  backBtn?.addEventListener('click', () => router.navigate('/'));
  
  // Initialize pong game logic here
  console.log('Pong game initialized');
};

const initAuthPage = () => {
  const backBtn = document.getElementById('back-btn');
  const form = document.getElementById('auth-form');
  
  backBtn?.addEventListener('click', () => router.navigate('/'));
  
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('Auth form submitted');
  });
};

const initNotFoundPage = () => {
  const homeBtn = document.getElementById('home-btn');
  homeBtn?.addEventListener('click', () => router.navigate('/'));
};

const router = new Router();

router.addRoute('/', 'home', initHomePage);
router.addRoute('/pong', 'pong', initPongPage);
router.addRoute('/auth', 'auth', initAuthPage);
router.addRoute('/404', '404', initNotFoundPage);