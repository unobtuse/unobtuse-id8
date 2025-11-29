import React, {
    useState
} from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    Platform,
    TextInput,
    TouchableOpacity,
} from "react-native";
import {
    SafeAreaView
} from "react-native-safe-area-context";
import Animated, {
    FadeIn,
    FadeInUp
} from "react-native-reanimated";
import {
    Ionicons
} from "@expo/vector-icons";
import BackgroundWrapper from "../components/BackgroundWrapper";
import GlassCard from "../components/GlassCard";
import Button from "../components/Button";
import {
    useAuth
} from "../context/AuthContext";
import {
    useTheme
} from "../context/ThemeContext";
import {
    useToast
} from "../context/ToastContext";

export default function AuthScreen() {
    const {
        signIn,
        signInWithEmail,
        registerWithEmail,
        loading,
        isReady
    } =
    useAuth();
    const {
        colors,
        theme
    } = useTheme();
    const {
        showToast
    } = useToast();
    const [mode, setMode] = useState("welcome");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [emailLoading, setEmailLoading] = useState(false);

    const logoUrl =
        theme === "dark" ? "/id8-logo-darkmode.svg" : "/id8-logo-lightmode.svg";

    const handleEmailLogin = async () => {
        if (!email.trim() || !password) {
            showToast("Please enter email and password", "error");
            return;
        }
        setEmailLoading(true);
        try {
            await signInWithEmail(email.trim(), password);
        } catch (error) {
            showToast(error.message || "Login failed", "error");
        } finally {
            setEmailLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!email.trim() || !password || !name.trim()) {
            showToast("Please fill in all fields", "error");
            return;
        }
        if (password.length < 6) {
            showToast("Password must be at least 6 characters", "error");
            return;
        }
        setEmailLoading(true);
        try {
            await registerWithEmail(email.trim(), password, name.trim());
        } catch (error) {
            showToast(error.message || "Registration failed", "error");
        } finally {
            setEmailLoading(false);
        }
    };

    const renderWelcome = () => ( <
        >
        <
        Text style = {
            [
                styles.cardDescription,
                {
                    color: colors.textSecondary,
                },
            ]
        } >
        Sign in to start tracking your ideas and collaborate with others. <
        /Text> <
        Button title = "Continue with Google"
        onPress = {
            signIn
        }
        loading = {
            loading
        }
        disabled = {
            !isReady
        }
        icon = {
            <
            Ionicons name = "logo-google"
            size = {
                20
            }
            color = "#000" / >
        }
        style = {
            styles.authButton
        }
        /> <
        View style = {
            [
                styles.divider,
                {
                    borderColor: colors.glassBorder,
                },
            ]
        } >
        <
        Text style = {
            [
                styles.dividerText,
                {
                    color: colors.textSecondary,
                },
            ]
        } >

        or <
        /Text> < /
        View > <
        Button title = "Sign in with Email"
        variant = "outline"
        onPress = {
            () => setMode("login")
        }
        icon = {
            <
            Ionicons name = "mail-outline"
            size = {
                20
            }
            color = {
                colors.text
            }
            />}
            style = {
                styles.authButton
            }
            /> <
            TouchableOpacity
            onPress = {
                () => setMode("register")
            }
            style = {
                styles.switchMode
            } >
            <
            Text
            style = {
                [
                    styles.switchText,
                    {
                        color: colors.textSecondary,
                    },
                ]
            } >
            Don 't have an account? <
            Text
            style = {
                {
                    color: colors.accent,
                }
            } >

            Sign up <
            /Text> < /
            Text > <
            /TouchableOpacity> < /
            >
        );

        const renderLogin = () => ( <
            >
            <
            Text style = {
                [
                    styles.cardTitle,
                    {
                        color: colors.text,
                    },
                ]
            } >

            Sign In <
            /Text> <
            TextInput style = {
                [
                    styles.input,
                    {
                        color: colors.text,
                        backgroundColor: `${colors.glass}50`,
                    },
                ]
            }
            placeholder = "Email"
            placeholderTextColor = {
                colors.textTertiary
            }
            value = {
                email
            }
            onChangeText = {
                setEmail
            }
            keyboardType = "email-address"
            autoCapitalize = "none" /
            >
            <
            TextInput style = {
                [
                    styles.input,
                    {
                        color: colors.text,
                        backgroundColor: `${colors.glass}50`,
                    },
                ]
            }
            placeholder = "Password"
            placeholderTextColor = {
                colors.textTertiary
            }
            value = {
                password
            }
            onChangeText = {
                setPassword
            }
            secureTextEntry /
            >
            <
            Button title = "Sign In"
            onPress = {
                handleEmailLogin
            }
            loading = {
                emailLoading
            }
            style = {
                styles.authButton
            }
            /> <
            TouchableOpacity onPress = {
                () => setMode("welcome")
            }
            style = {
                styles.backButton
            } >
            <
            Ionicons name = "arrow-back"
            size = {
                18
            }
            color = {
                colors.textSecondary
            }
            /> <
            Text style = {
                [
                    styles.backText,
                    {
                        color: colors.textSecondary,
                    },
                ]
            } >

            Back <
            /Text> < /
            TouchableOpacity > <
            />
        );

        const renderRegister = () => ( <
            >
            <
            Text style = {
                [
                    styles.cardTitle,
                    {
                        color: colors.text,
                    },
                ]
            } >

            Create Account <
            /Text> <
            TextInput style = {
                [
                    styles.input,
                    {
                        color: colors.text,
                        backgroundColor: `${colors.glass}50`,
                    },
                ]
            }
            placeholder = "Name"
            placeholderTextColor = {
                colors.textTertiary
            }
            value = {
                name
            }
            onChangeText = {
                setName
            }
            /> <
            TextInput style = {
                [
                    styles.input,
                    {
                        color: colors.text,
                        backgroundColor: `${colors.glass}50`,
                    },
                ]
            }
            placeholder = "Email"
            placeholderTextColor = {
                colors.textTertiary
            }
            value = {
                email
            }
            onChangeText = {
                setEmail
            }
            keyboardType = "email-address"
            autoCapitalize = "none" /
            >
            <
            TextInput style = {
                [
                    styles.input,
                    {
                        color: colors.text,
                        backgroundColor: `${colors.glass}50`,
                    },
                ]
            }
            placeholder = "Password (min 6 characters)"
            placeholderTextColor = {
                colors.textTertiary
            }
            value = {
                password
            }
            onChangeText = {
                setPassword
            }
            secureTextEntry /
            >
            <
            Button title = "Create Account"
            onPress = {
                handleRegister
            }
            loading = {
                emailLoading
            }
            style = {
                styles.authButton
            }
            /> <
            TouchableOpacity onPress = {
                () => setMode("welcome")
            }
            style = {
                styles.backButton
            } >
            <
            Ionicons name = "arrow-back"
            size = {
                18
            }
            color = {
                colors.textSecondary
            }
            /> <
            Text style = {
                [
                    styles.backText,
                    {
                        color: colors.textSecondary,
                    },
                ]
            } >

            Back <
            /Text> < /
            TouchableOpacity > <
            />
        );

        return ( <
            BackgroundWrapper >
            <
            SafeAreaView style = {
                styles.container
            } >
            <
            View style = {
                styles.content
            } >
            <
            Animated.View entering = {
                FadeIn.duration(800)
            }
            style = {
                styles.logoContainer
            } >

            {
                Platform.OS === "web" ? ( <
                    img src = {
                        logoUrl
                    }
                    style = {
                        {
                            width: 280,
                            height: 100,
                        }
                    }
                    alt = "ID8 logo" /
                    >
                ) : ( <
                    Image source = {
                        require("../../assets/icon.png")
                    }
                    style = {
                        styles.logo
                    }
                    resizeMode = "contain" /
                    >
                )
            } <
            /Animated.View> <
            Animated.View entering = {
                FadeInUp.delay(300).duration(600)
            } >
            <
            Text style = {
                [
                    styles.subtitle,
                    {
                        color: colors.textSecondary,
                    },
                ]
            } >
            Capture ideas.Iterate.Collaborate. <
            /Text> < /
            Animated.View > <
            Animated.View entering = {
                FadeInUp.delay(500).duration(600)
            }
            style = {
                styles.cardContainer
            } >
            <
            GlassCard style = {
                styles.card
            }
            intensity = {
                30
            } >

            {
                mode === "welcome" && renderWelcome()
            } {
                mode === "login" && renderLogin()
            } {
                mode === "register" && renderRegister()
            } <
            /GlassCard> < /
            Animated.View > <
            /View> <
            Animated.Text entering = {
                FadeIn.delay(800).duration(600)
            }
            style = {
                [
                    styles.footer,
                    {
                        color: colors.textTertiary,
                    },
                ]
            } >
            By continuing, you agree to our Terms of Service <
            /Animated.Text> < /
            SafeAreaView > <
            /BackgroundWrapper>
        );
    }

    const styles = StyleSheet.create({
        container: {
            flex: 1,
        },
        content: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32, // Increased padding
            paddingVertical: 40,
        },
        logoContainer: {
            marginBottom: 32, // Increased margin
        },
        logo: {
            width: 120,
            height: 120,
            marginBottom: 20,
        },
        subtitle: {
            fontSize: 18, // Slightly larger
            textAlign: "center",
            marginBottom: 56, // Increased margin
            fontWeight: "500",
        },
        cardContainer: {
            width: "100%",
            maxWidth: 420, // Slightly wider
        },
        card: {
            alignItems: "center",
            paddingVertical: 32, // Add internal padding to card
            paddingHorizontal: 24,
        },
        cardTitle: {
            fontSize: 24,
            fontWeight: "bold",
            marginBottom: 8,
            textAlign: "center", // Center title
        },
        cardDescription: {
            fontSize: 14,
            marginBottom: 24,
            textAlign: "center", // Center description
        },
        authButton: {
            width: "100%",
            marginTop: 8,
        },
        divider: {
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            marginVertical: 24, // Increased margin
        },
        dividerText: {
            fontSize: 14,
            paddingHorizontal: 12,
            fontWeight: "500",
        },
        input: {
            width: "100%",
            borderRadius: 16,
            paddingHorizontal: 20,
            paddingVertical: 16,
            fontSize: 16,
            marginBottom: 16,
            marginTop: 8,
        },
        switchMode: {
            marginTop: 24, // Increased margin
            alignItems: "center",
        },
        switchText: {
            fontSize: 14,
            textAlign: "center",
        },
        backButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 24, // Increased margin
            gap: 6,
            paddingVertical: 8,
        },
        backText: {
            fontSize: 15,
            fontWeight: "500",
        },
        footer: {
            fontSize: 13,
            textAlign: "center",
            paddingBottom: 24,
            opacity: 0.7,
        },
    });