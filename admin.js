var supabase = window.supabase.createClient("https://xswkxjymswnveppratwx.supabase.co", "sb_publishable_ML6SKo4r_uB6TzkQuK9gNQ_VPCKj-h1");

let InSignUpState = false;

const formHeading = document.getElementById("formHeading");
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
        if (formHeading) formHeading.innerText = "Register New Admin";
        nameRow.style.display = "block";
        submitBtn.innerText = "Register Admin Account";
        toggleText.innerText = "Already registered as an admin?";
        toggleBtn.innerText = "Admin Log In";
    } else {
        if (formHeading) formHeading.innerText = "Admin Portal Login";
        nameRow.style.display = "none";
        submitBtn.innerText = "Authenticate Admin";
        toggleText.innerText = "Need to register a new admin?";
        toggleBtn.innerText = "Create Admin Account";
        nameInput.value = "";
    }
});

submitBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const fullname = nameInput.value.trim();

    if (!email || !password) {
        Swal.fire({ title: 'Access Denied', text: 'Please provide complete administrative credentials.', icon: 'error' });
        return;
    }

    if (InSignUpState) {
        if (!fullname) {
            Swal.fire({ title: 'Access Denied', text: 'Administrator full name is required to register.', icon: 'error' });
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullname,
                        role: "admin"
                    }
                }
            });

            if (error) {
                Swal.fire({ title: 'Admin Registration Failed', text: error.message, icon: 'error' });
                return;
            } else {
                Swal.fire({
                    title: 'Admin Created!',
                    text: 'Administrative profile registered successfully. Redirecting to control panel...',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = "admin.html";
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
                Swal.fire({ title: 'Authentication Failed', text: error.message, icon: 'error' });
                return;
            } else {
                const adminName = data.user.user_metadata.full_name || data.user.email.split('@')[0] || "Admin";

                localStorage.setItem('isAdminLoggedIn', 'true');
                localStorage.setItem('adminName', adminName);

                Swal.fire({
                    title: 'Access Granted',
                    text: 'Welcome to the Admin Dashboard!',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = "adminPannel.html";
                });
            }
        } catch (error) {
            console.log(error);
        }
    }
});