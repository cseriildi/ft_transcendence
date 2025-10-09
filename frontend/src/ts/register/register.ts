export async function handleRegisterFormSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get('email');
    const username = formData.get('username');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    try {
        const response = await fetch('http://localhost:3000/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password, confirmPassword }),
        });
        const data = await response.json();
        if (response.ok) {
            if (data.data?.tokens?.accessToken) {
                document.cookie = `accessToken=${data.data.tokens.accessToken}; Path=/; SameSite=Strict; Secure`;
            }
            console.log('accessToken', document.cookie.match(/(?:^|; )accessToken=([^;]*)/))
            console.log('Register successful', data);
        } else {
            // Handle error (e.g., show error message)
            console.error('Register failed', data);
        }
    } catch (err) {
        console.error('Network error', err);
    }
}
