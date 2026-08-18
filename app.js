var supabase = window.supabase.createClient("https://xswkxjymswnveppratwx.supabase.co", "sb_publishable_ML6SKo4r_uB6TzkQuK9gNQ_VPCKj-h1");

let InSignUpState = false;

const nameRow = document.getElementById("nameRow");
const nameInput = document.getElementById("fullname");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const toggleText = document.getElementById("toggleText");
const toggleBtn = document.getElementById("toggleBtn");

toggleBtn.addEventListener('click', () => {
    InSignUpState = !InSignUpState;
    if (InSignUpState) {
        nameRow.style.display = "block";
        submitBtn.innerText = "Create Account";
        toggleText.innerText = "Already have an account?";
        toggleBtn.innerText = "Log In";
    } else {
        nameRow.style.display = "none";
        submitBtn.innerText = "Log In";
        toggleText.innerText = "Don't have an account?";
        toggleBtn.innerText = "Create Account";
        fullnameInput.value = "";
    }
});

submitBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const fullname = nameInput.value.trim();

    if (!email || !password) {
        Swal.fire({ title: 'Error!', text: 'Please fill in all fields.', icon: 'error' });
        return;
    }

    if (InSignUpState) {
        if (!nameInput.value.trim()) {
            Swal.fire({ title: 'Error!', text: 'Full name is required to sign up.', icon: 'error' });
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        first_name: fullname
                    }
                }
            });

            if (error) {
                Swal.fire({ title: 'Signup Failed', text: error.message, icon: 'error' });
                return;
            } else {
                Swal.fire({
                    title: 'Success!',
                    text: 'Registered successfully!',
                    icon: 'success'
                });
            }
        } catch (error) {
            console.log(error);
        }

    } else {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                Swal.fire({ title: 'Login Failed', text: error.message, icon: 'error' });
                return;
            } else {
                const userName = data.user.user_metadata.display_name || "User";

                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userName', userName);
                Swal.fire({
                    title: 'Welcome!',
                    text: 'Login successful!',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = "/student.html";

                });

            }
        } catch (error) {
            console.log(error);
        }
    }
});