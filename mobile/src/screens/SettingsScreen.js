import React, {
    useState,
    useEffect,
    useRef
} from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Image,
    Platform,
    FlatList,
    ActivityIndicator,
    Modal,
    TextInput,
} from "react-native";
import {
    SafeAreaView
} from "react-native-safe-area-context";
import {
    Ionicons
} from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as ImagePicker from "expo-image-picker";
import Animated, {
    FadeIn,
    FadeInUp
} from "react-native-reanimated";
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
import {
    api
} from "../services/api";
import {
    subscribeToPush,
    isPushSupported,
    checkPushSubscription,
} from "../services/pushNotifications";

export default function SettingsScreen({
    navigation
}) {
    const {
        user,
        signOut,
        updateUser
    } = useAuth();
    const {
        colors,
        theme,
        toggleTheme,
        backgroundUrl,
        backgroundType,
        updateBackground,
    } = useTheme();
    const {
        showToast
    } = useToast();
    const [uploading, setUploading] = useState(false);
    const [confirmSignOut, setConfirmSignOut] = useState(false);
    const [testingNotification, setTestingNotification] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [screenName, setScreenName] = useState(user?.screen_name || "");
    const [screenNameEditing, setScreenNameEditing] = useState(false);
    const [savingScreenName, setSavingScreenName] = useState(false);
    const [expoUrl, setExpoUrl] = useState(null);
    const [stickers, setStickers] = useState([]);
    const [loadingStickers, setLoadingStickers] = useState(true);
    const [uploadingSticker, setUploadingSticker] = useState(false);
    const [stickerNameModal, setStickerNameModal] = useState({ visible: false, file: null });
    const [stickerName, setStickerName] = useState("");
    const stickerInputRef = useRef(null);

    useEffect(() => {
        // Fetch dynamic Expo URL
        if (Platform.OS === 'web') {
            fetch(`/expo-config.json?t=${Date.now()}`)
                .then(res => res.json())
                .then(data => setExpoUrl(data.expoUrl))
                .catch(err => console.log('Failed to load expo config', err));
        }
        // Fetch stickers
        fetchStickers();
    }, []);

    const fetchStickers = async () => {
        try {
            const data = await api.get('/stickers');
            setStickers(data);
        } catch (error) {
            console.error('Failed to fetch stickers:', error);
        } finally {
            setLoadingStickers(false);
        }
    };

    const handleAddSticker = () => {
        if (Platform.OS === 'web') {
            stickerInputRef.current?.click();
        } else {
            pickStickerNative();
        }
    };

    const pickStickerNative = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });
        if (!result.canceled) {
            // Show naming modal instead of uploading directly
            setStickerName("");
            setStickerNameModal({ visible: true, file: result.assets[0] });
        }
    };

    const handleStickerFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (file) {
            // Show naming modal instead of uploading directly
            setStickerName("");
            setStickerNameModal({ visible: true, file });
            if (stickerInputRef.current) stickerInputRef.current.value = '';
        }
    };

    const handleStickerNameSubmit = async () => {
        if (!stickerName.trim()) {
            showToast('Please enter a name for your sticker', 'error');
            return;
        }
        const file = stickerNameModal.file;
        setStickerNameModal({ visible: false, file: null });
        await uploadSticker(file, stickerName.trim());
    };

    const uploadSticker = async (file, name) => {
        setUploadingSticker(true);
        try {
            const result = await api.uploadFile('/stickers', file, { name });
            setStickers(prev => [result, ...prev]);
            showToast('Sticker added!', 'success');
        } catch (error) {
            showToast(error.message || 'Failed to upload sticker', 'error');
        } finally {
            setUploadingSticker(false);
        }
    };

    const handleDeleteSticker = async (stickerId) => {
        try {
            await api.delete(`/stickers/${stickerId}`);
            setStickers(prev => prev.filter(s => s.id !== stickerId));
            showToast('Sticker deleted', 'success');
        } catch (error) {
            showToast('Failed to delete sticker', 'error');
        }
    };

    // AI API Keys State
    const [openaiKey, setOpenaiKey] = useState(user?.openai_key || "");
    const fileInputRef = useRef(null);
    const avatarInputRef = useRef(null);

    const pushSupported = Platform.OS === "web" && isPushSupported();

    useEffect(() => {
        // Check if notifications are actually subscribed (not just permission)
        const checkSubscription = async () => {
            if (Platform.OS === "web") {
                const status = await checkPushSubscription();
                setNotificationsEnabled(
                    status.subscribed && status.permission === "granted",
                );
                console.log("Push subscription status:", status);
            }
        };
        checkSubscription();
    }, []);

    const handleEnableNotifications = async () => {
        const result = await subscribeToPush();
        if (result.success) {
            setNotificationsEnabled(true);
            showToast("Notifications enabled!", "success");
        } else {
            showToast(result.error || "Failed to enable notifications", "error");
        }
    };

    const handleTestNotification = async () => {
        setTestingNotification(true);
        try {
            await api.post("/push/test");
            showToast(
                "Test notification sent! Check your browser/device.",
                "success",
            );
        } catch (error) {
            showToast("Failed to send test notification", "error");
        } finally {
            setTestingNotification(false);
        }
    };

    const handlePickBackground = async () => {
        if (Platform.OS === "web") {
            fileInputRef.current?.click();
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            quality: 1,
        });

        if (!result.canceled) {
            await uploadBackgroundFile(result.assets[0]);
        }
    };

    const handlePickAvatar = async () => {
        if (Platform.OS === "web") {
            avatarInputRef.current?.click();
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
        });

        if (!result.canceled) {
            await uploadAvatarFile(result.assets[0]);
        }
    };

    const handleWebFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (file) {
            await uploadBackgroundFile(file);
        }
    };

    const handleWebAvatarChange = async (event) => {
        const file = event.target.files?.[0];
        if (file) {
            await uploadAvatarFile(file);
        }
    };

    const uploadBackgroundFile = async (file) => {
        setUploading(true);
        try {
            let fileToUpload;

            if (file instanceof File) {
                // Web file
                fileToUpload = file;
            } else {
                // React Native asset
                const isVideo =
                    file.type === "video" || file.mimeType?.startsWith("video/");
                fileToUpload = {
                    uri: file.uri,
                    name: isVideo ? "background.mp4" : "background.jpg",
                    mimeType: isVideo ? "video/mp4" : "image/jpeg",
                };
            }

            const response = await api.uploadFile(
                "/settings/background",
                fileToUpload,
            );
            await updateBackground(response.background_url, response.background_type);

            if (Platform.OS === "web") {
                // Reset file input
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        } catch (error) {
            console.error("Upload error:", error);
            showToast("Failed to upload background", "error");
        } finally {
            setUploading(false);
        }
    };

    const uploadAvatarFile = async (file) => {
        setUploading(true);
        try {
            let fileToUpload;

            if (file instanceof File) {
                fileToUpload = file;
            } else {
                fileToUpload = {
                    uri: file.uri,
                    name: "avatar.jpg",
                    mimeType: "image/jpeg",
                };
            }

            const response = await api.uploadFile("/settings/avatar", fileToUpload);
            await updateUser({
                avatar_url: response.avatar_url,
            });
            showToast("Avatar updated", "success");

            if (Platform.OS === "web") {
                if (avatarInputRef.current) avatarInputRef.current.value = "";
            }
        } catch (error) {
            console.error("Avatar upload error:", error);
            showToast("Failed to upload avatar", "error");
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveBackground = async () => {
        try {
            await api.delete("/settings/background");
            await updateBackground(null, "image");
            showToast("Background removed", "success");
        } catch (error) {
            showToast("Failed to remove background", "error");
        }
    };

    const handleSignOut = () => {
        setConfirmSignOut(true);
    };

    const confirmSignOutAction = () => {
        setConfirmSignOut(false);
        signOut();
    };

    const handleShareApp = async () => {
        try {
            const result = await Share.share({
                message: "Check out this awesome app!",
                url: "https://your-app-url.com", // Replace with your app's actual URL
                title: "Share App",
            });

            if (result.action === Share.sharedAction) {
                if (result.activityType) {
                    // shared with activity type of result.activityType
                    showToast("App shared successfully!", "success");
                } else {
                    // shared
                    showToast("App shared successfully!", "success");
                }
            } else if (result.action === Share.dismissedAction) {
                // dismissed
                showToast("Share dismissed", "info");
            }
        } catch (error) {
            showToast("Error sharing app: " + error.message, "error");
        }
    };

    return ( <
        BackgroundWrapper >

        {
            Platform.OS === "web" && ( <
                >
                <
                input type = "file"
                ref = {
                    fileInputRef
                }
                style = {
                    {
                        display: "none",
                    }
                }
                accept = "image/*,video/*"
                onChange = {
                    handleWebFileChange
                }
                /> <
                input type = "file"
                ref = {
                    avatarInputRef
                }
                style = {
                    {
                        display: "none",
                    }
                }
                accept = "image/*"
                onChange = {
                    handleWebAvatarChange
                }
                /> <
                input type = "file"
                ref = {
                    stickerInputRef
                }
                style = {
                    {
                        display: "none",
                    }
                }
                accept = "image/*,image/gif"
                onChange = {
                    handleStickerFileChange
                }
                /> <
                />
            )
        } <
        SafeAreaView style = {
            styles.container
        } >
        <
        View style = {
            styles.header
        } >
        <
        TouchableOpacity onPress = {
            () => navigation.goBack()
        }
        style = {
            styles.closeButton
        } >
        <
        Ionicons name = "close"
        size = {
            28
        }
        color = {
            colors.text
        }
        /> <
        /TouchableOpacity> <
        Text style = {
            [
                styles.title,
                {
                    color: colors.text,
                },
            ]
        } >

        Settings <
        /Text> <
        View style = {
            {
                width: 44,
            }
        }
        /> <
        /View> <
        ScrollView style = {
            styles.content
        }
        showsVerticalScrollIndicator = {
            false
        } >
        <
        Animated.View entering = {
            FadeInUp.delay(100).duration(400)
        } >
        <
        TouchableOpacity onPress = {
            handlePickAvatar
        } >
        <
        GlassCard style = {
            styles.profileCard
        } >

        {
            user?.avatar_url ? ( <
                Image source = {
                    {
                        uri: user.avatar_url,
                    }
                }
                style = {
                    styles.avatar
                }
                />
            ) : ( <
                View style = {
                    [
                        styles.avatar,
                        {
                            backgroundColor: colors.accent,
                        },
                    ]
                } >
                <
                Text style = {
                    styles.avatarText
                } >

                {
                    user?.name?.charAt(0)?.toUpperCase()
                } <
                /Text> <
                View style = {
                    {
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        backgroundColor: colors.surface,
                        borderRadius: 10,
                        padding: 2,
                    }
                } >
                <
                Ionicons name = "camera"
                size = {
                    12
                }
                color = {
                    colors.text
                }
                /> <
                /View> <
                /View>
            )
        } <
        View style = {
            {
                alignItems: "center",
            }
        } >
        <
        Text style = {
            [
                styles.userName,
                {
                    color: colors.text,
                },
            ]
        } >

        {
            user?.name
        } <
        /Text> <
        Text style = {
            [
                styles.userEmail,
                {
                    color: colors.textSecondary,
                },
            ]
        } >

        {
            user?.email
        } <
        /Text> <
        Text style = {
            {
                fontSize: 12,
                color: colors.accent,
                marginTop: 4,
            }
        } >
        Tap to change avatar <
        /Text> <
        /View> <
        /GlassCard> <
        /TouchableOpacity> <
        /Animated.View> <
        Animated.View entering = {
            FadeInUp.delay(200).duration(400)
        } >
        <
        Text style = {
            [
                styles.sectionTitle,
                {
                    color: colors.textSecondary,
                },
            ]
        } >
        Appearance <
        /Text> <
        GlassCard >
        <
        View style = {
            styles.settingRow
        } >
        <
        View style = {
            styles.settingInfo
        } >
        <
        Ionicons name = {
            theme === "dark" ? "moon" : "sunny"
        }
        size = {
            22
        }
        color = {
            colors.accent
        }
        /> <
        Text style = {
            [
                styles.settingLabel,
                {
                    color: colors.text,
                },
            ]
        } >
        Dark Mode <
        /Text> <
        /View> <
        Switch value = {
            theme === "dark"
        }
        onValueChange = {
            toggleTheme
        }
        trackColor = {
            {
                false: colors.surface,
                true: theme === "dark" ? "#52525b" : "#a1a1aa",
            }
        }
        thumbColor = {theme === "dark" ? colors.accent : "#fff"} /
        >
        <
        /View> <
        View style = {
            [
                styles.divider,
                {
                    backgroundColor: colors.divider,
                },
            ]
        }
        /> <
        View style = {
            styles.settingRow
        } >
        <
        View style = {
            styles.settingInfo
        } >
        <
        Ionicons name = "image-outline"
        size = {
            22
        }
        color = {
            colors.accent
        }
        /> <
        View >
        <
        Text style = {
            [
                styles.settingLabel,
                {
                    color: colors.text,
                },
            ]
        } >
        Custom Background <
        /Text> <
        Text style = {
            [
                styles.settingHint,
                {
                    color: colors.textTertiary,
                },
            ]
        } >
        Image or video <
        /Text> <
        /View> <
        /View> <
        /View> {
            backgroundUrl && ( <
                View style = {
                    styles.backgroundPreview
                } >

                {
                    backgroundType === "video" ? (
                        Platform.OS === "web" ? ( <
                            video src = {
                                backgroundUrl
                            }
                            style = {
                                {
                                    width: "100%",
                                    height: 120,
                                    borderRadius: 8,
                                    objectFit: "cover",
                                }
                            }
                            muted autoPlay loop playsInline /
                            >
                        ) : ( <
                            View style = {
                                [
                                    styles.backgroundImage,
                                    {
                                        backgroundColor: colors.surface,
                                        justifyContent: "center",
                                        alignItems: "center",
                                    },
                                ]
                            } >
                            <
                            Ionicons name = "videocam"
                            size = {
                                32
                            }
                            color = {
                                colors.textSecondary
                            }
                            /> <
                            Text style = {
                                [
                                    styles.settingHint,
                                    {
                                        color: colors.textSecondary,
                                        marginTop: 4,
                                    },
                                ]
                            } >
                            Video Background <
                            /Text> <
                            /View>
                        )
                    ) : ( <
                        Image source = {
                            {
                                uri: backgroundUrl,
                            }
                        }
                        style = {
                            styles.backgroundImage
                        }
                        />
                    )
                } <
                /View>
            )
        } <
        View style = {
            styles.backgroundActions
        } >
        <
        Button title = {
            backgroundUrl ? "Change" : "Choose Background"
        }
        onPress = {
            handlePickBackground
        }
        loading = {
            uploading
        }
        style = {
            {
                flex: 1,
            }
        }
        /> {
            backgroundUrl && ( <
                Button title = "Restore Default"
                variant = "outline"
                onPress = {
                    handleRemoveBackground
                }
                style = {
                    {
                        flex: 1,
                        marginLeft: 8,
                    }
                }
                />
            )
        } <
        /View> <
        /GlassCard> <
        /Animated.View>

        <Animated.View entering={FadeInUp.delay(250).duration(400)}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Stickers
            </Text>
            <GlassCard>
                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Ionicons name="happy-outline" size={22} color={colors.accent} />
                        <View>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                                My Stickers
                            </Text>
                            <Text style={[styles.settingHint, { color: colors.textTertiary }]}>
                                {stickers.length} / 50 stickers
                            </Text>
                        </View>
                    </View>
                    <Button
                        title={uploadingSticker ? "Adding..." : "Add"}
                        onPress={handleAddSticker}
                        loading={uploadingSticker}
                        style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                        icon={<Ionicons name="add" size={18} color="#000" />}
                    />
                </View>
                {loadingStickers ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <ActivityIndicator color={colors.accent} />
                    </View>
                ) : stickers.length > 0 ? (
                    <View style={styles.stickersGrid}>
                        {stickers.map((sticker) => (
                            <View key={sticker.id} style={styles.stickerItemContainer}>
                                <Image
                                    source={{ uri: sticker.file_url }}
                                    style={styles.stickerItem}
                                />
                                <Text 
                                    style={[styles.stickerNameLabel, { color: colors.textSecondary }]}
                                    numberOfLines={1}
                                >
                                    :{sticker.name}:
                                </Text>
                                <TouchableOpacity
                                    style={styles.deleteStickerBtn}
                                    onPress={() => handleDeleteSticker(sticker.id)}
                                >
                                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                        <Text style={[styles.settingHint, { color: colors.textTertiary }]}>
                            No stickers yet. Add some to use in chats!
                        </Text>
                    </View>
                )}
            </GlassCard>
        </Animated.View>

        {
            Platform.OS === "web" && ( <
                Animated.View entering = {
                    FadeInUp.delay(300).duration(400)
                } >
                <
                Text style = {
                    [
                        styles.sectionTitle,
                        {
                            color: colors.textSecondary,
                        },
                    ]
                } >
                Notifications <
                /Text> <
                GlassCard >
                <
                View style = {
                    styles.settingRow
                } >
                <
                View style = {
                    styles.settingInfo
                } >
                <
                Ionicons name = "notifications-outline"
                size = {
                    22
                }
                color = {
                    colors.accent
                }
                /> <
                View >
                <
                Text style = {
                    [
                        styles.settingLabel,
                        {
                            color: colors.text,
                        },
                    ]
                } >
                Push Notifications <
                /Text> <
                Text style = {
                    [
                        styles.settingHint,
                        {
                            color: colors.textTertiary,
                        },
                    ]
                } >

                {
                    notificationsEnabled ? "Enabled" : "Disabled"
                } <
                /Text> <
                /View> <
                /View> {
                    !notificationsEnabled && pushSupported && ( <
                        Button title = "Enable"
                        onPress = {
                            handleEnableNotifications
                        }
                        style = {
                            {
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                            }
                        }
                        />
                    )
                } <
                /View> {
                    notificationsEnabled && ( <
                        >
                        <
                        View style = {
                            [
                                styles.divider,
                                {
                                    backgroundColor: colors.divider,
                                },
                            ]
                        }
                        /> <
                        View style = {
                            styles.settingRow
                        } >
                        <
                        View style = {
                            styles.settingInfo
                        } >
                        <
                        Ionicons name = "paper-plane-outline"
                        size = {
                            22
                        }
                        color = {
                            colors.accent
                        }
                        /> <
                        Text style = {
                            [
                                styles.settingLabel,
                                {
                                    color: colors.text,
                                },
                            ]
                        } >
                        Test Notification <
                        /Text> <
                        /View> <
                        Button title = "Send Test"
                        variant = "outline"
                        onPress = {
                            handleTestNotification
                        }
                        loading = {
                            testingNotification
                        }
                        style = {
                            {
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                            }
                        }
                        /> <
                        /View> <
                        />
                    )
                } {
                    !pushSupported && ( <
                        View style = {
                            {
                                marginTop: 8,
                            }
                        } >
                        <
                        Text style = {
                            [
                                styles.settingHint,
                                {
                                    color: colors.textTertiary,
                                },
                            ]
                        } >
                        Add ID8 to your home screen to enable push notifications. <
                        /Text> <
                        /View>
                    )
                } <
                /GlassCard> <
                /Animated.View>
            )
        } <
        Animated.View entering = {
            FadeInUp.delay(400).duration(400)
        } >
        <
        Text style = {
            [
                styles.sectionTitle,
                {
                    color: colors.textSecondary,
                },
            ]
        } >
        About <
        /Text> <
        GlassCard >
        <
        View style = {
            styles.aboutRow
        } >
        <
        Text style = {
            [
                styles.aboutLabel,
                {
                    color: colors.textSecondary,
                },
            ]
        } >
        Version <
        /Text> <
        Text style = {
            [
                styles.aboutValue,
                {
                    color: colors.text,
                },
            ]
        } >
        1.0 .0 <
        /Text> <
        /View> <
        View style = {
            [
                styles.divider,
                {
                    backgroundColor: colors.divider,
                },
            ]
        }
        /> <
        TouchableOpacity style = {
            styles.aboutRow
        } >
        <
        Text style = {
            [
                styles.aboutLabel,
                {
                    color: colors.textSecondary,
                },
            ]
        } >
        GitHub <
        /Text> <
        View style = {
            styles.linkRow
        } >
        <
        Text style = {
            [
                styles.aboutValue,
                {
                    color: colors.accent,
                },
            ]
        } >
        unobtuse / unobtuse - id8 <
        /Text> <
        Ionicons name = "open-outline"
        size = {
            16
        }
        color = {
            colors.accent
        }
        /> <
        /View> <
        /TouchableOpacity> <
        /GlassCard> <
        /Animated.View> <
        Animated.View entering = {
            FadeInUp.delay(500).duration(400)
        } >
        <
        Text style = {
            [
                styles.sectionTitle,
                {
                    color: colors.textSecondary,
                },
            ]
        } >
        Mobile App <
        /Text> <
        GlassCard >
        <
        View style = {
            {
                alignItems: "center",
                padding: 20,
            }
        } >
        {
            expoUrl ? ( <
                >
                <
                View style = {
                    {
                        padding: 10,
                        backgroundColor: "white",
                        borderRadius: 10,
                    }
                } >
                <
                QRCode value = {
                    expoUrl
                }
                size = {
                    150
                }
                /> <
                /View> <
                Text style = {
                    {
                        marginTop: 16,
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: "600",
                        textAlign: "center",
                    }
                } >
                Scan to Launch App <
                /Text> <
                View style = {
                    {
                        marginTop: 12,
                        alignItems: 'flex-start'
                    }
                } >
                <
                Text style = {
                    {
                        color: colors.textSecondary,
                        fontSize: 14,
                        marginBottom: 4
                    }
                } >
                1. Download 'Expo Go'
                from App Store / Play Store <
                /Text> <
                Text style = {
                    {
                        color: colors.textSecondary,
                        fontSize: 14
                    }
                } >
                2. Scan this QR code with your camera <
                /Text> <
                /View> <
                Text style = {
                    {
                        marginTop: 12,
                        color: colors.textTertiary,
                        fontSize: 12,
                        textAlign: "center"
                    }
                } >
                {
                    expoUrl
                } <
                /Text> <
                />
            ) : ( <
                Text style = {
                    {
                        color: colors.textSecondary
                    }
                } > Loading Expo configuration... < /Text>
            )
        } <
        /View> <
        /GlassCard> <
        /Animated.View> <
        Animated.View entering = {
            FadeInUp.delay(400).duration(400)
        }
        style = {
            styles.signOutSection
        } >
        <
        Button title = "Sign Out"
        variant = "outline"
        onPress = {
            handleSignOut
        }
        icon = {
            <
            Ionicons
            name = "log-out-outline"
            size = {
                20
            }
            color = {
                colors.text
            }
            />
        }
        /> <
        /Animated.View> <
        /ScrollView> <
        /SafeAreaView> {
            confirmSignOut && ( <
                View style = {
                    styles.modalOverlay
                } >
                <
                View style = {
                    [
                        styles.confirmModal,
                        {
                            backgroundColor: colors.glass,
                            borderColor: colors.glassBorder,
                            ...Platform.select({
                                web: {
                                    backdropFilter: "blur(10px)",
                                },
                            }),
                        },
                    ]
                } >
                <
                Text style = {
                    [
                        styles.confirmTitle,
                        {
                            color: colors.text,
                        },
                    ]
                } >

                Sign Out ?
                <
                /Text> <
                Text style = {
                    [
                        styles.confirmMessage,
                        {
                            color: colors.textSecondary,
                        },
                    ]
                } >
                Are you sure you want to sign out ?
                <
                /Text> <
                View style = {
                    styles.confirmButtons
                } >
                <
                TouchableOpacity style = {
                    [
                        styles.confirmButton,
                        styles.cancelButton,
                        {
                            borderColor: colors.glassBorder,
                        },
                    ]
                }
                onPress = {
                    () => setConfirmSignOut(false)
                } >
                <
                Text style = {
                    [
                        styles.confirmButtonText,
                        {
                            color: colors.text,
                        },
                    ]
                } >

                Cancel <
                /Text> <
                /TouchableOpacity> <
                TouchableOpacity style = {
                    [styles.confirmButton, styles.signOutButton]
                }
                onPress = {
                    confirmSignOutAction
                } >
                <
                Text style = {
                    [
                        styles.confirmButtonText,
                        {
                            color: "#fff",
                        },
                    ]
                } >

                Sign Out <
                /Text> <
                /TouchableOpacity> <
                /View> <
                /View> <
                /View>
            )
        } {
            /* Sticker Name Modal */
        } {
            stickerNameModal.visible && (
                Platform.OS === "web" ? (
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }} onClick={() => setStickerNameModal({ visible: false, file: null })}>
                        <div onClick={(e) => e.stopPropagation()} style={{
                            backgroundColor: colors.glass,
                            borderRadius: 16,
                            padding: 24,
                            maxWidth: 320,
                            width: "90%",
                            border: `1px solid ${colors.glassBorder}`,
                        }}>
                            <Text style={[styles.confirmTitle, { color: colors.text }]}>
                                Name Your Sticker
                            </Text>
                            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                                Use this name to call it with :name: in chat
                            </Text>
                            <TextInput
                                style={[styles.stickerNameInput, { 
                                    color: colors.text, 
                                    borderColor: colors.glassBorder,
                                    backgroundColor: colors.surface 
                                }]}
                                placeholder="e.g., laughing-face"
                                placeholderTextColor={colors.textTertiary}
                                value={stickerName}
                                onChangeText={setStickerName}
                                autoFocus
                                autoCapitalize="none"
                            />
                            <View style={styles.confirmButtons}>
                                <TouchableOpacity
                                    style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.glassBorder }]}
                                    onPress={() => setStickerNameModal({ visible: false, file: null })}
                                >
                                    <Text style={[styles.confirmButtonText, { color: colors.text }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.confirmButton, { backgroundColor: colors.accent }]}
                                    onPress={handleStickerNameSubmit}
                                >
                                    <Text style={[styles.confirmButtonText, { color: "#000" }]}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </div>
                    </div>
                ) : (
                    <Modal visible={stickerNameModal.visible} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={[styles.confirmModal, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                                    Name Your Sticker
                                </Text>
                                <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                                    Use this name to call it with :name: in chat
                                </Text>
                                <TextInput
                                    style={[styles.stickerNameInput, { 
                                        color: colors.text, 
                                        borderColor: colors.glassBorder,
                                        backgroundColor: colors.surface 
                                    }]}
                                    placeholder="e.g., laughing-face"
                                    placeholderTextColor={colors.textTertiary}
                                    value={stickerName}
                                    onChangeText={setStickerName}
                                    autoFocus
                                    autoCapitalize="none"
                                />
                                <View style={styles.confirmButtons}>
                                    <TouchableOpacity
                                        style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.glassBorder }]}
                                        onPress={() => setStickerNameModal({ visible: false, file: null })}
                                    >
                                        <Text style={[styles.confirmButtonText, { color: colors.text }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.confirmButton, { backgroundColor: colors.accent }]}
                                        onPress={handleStickerNameSubmit}
                                    >
                                        <Text style={[styles.confirmButtonText, { color: "#000" }]}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                )
            )
        } <
        /BackgroundWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    closeButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    profileCard: {
        alignItems: "center",
        paddingVertical: 24,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: "600",
        color: "#000",
    },
    userName: {
        fontSize: 20,
        fontWeight: "600",
    },
    userEmail: {
        fontSize: 14,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: "600",
        marginTop: 24,
        marginBottom: 8,
        marginLeft: 4,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    settingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 4,
    },
    settingInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    settingLabel: {
        fontSize: 16,
    },
    settingHint: {
        fontSize: 12,
        marginTop: 2,
    },
    divider: {
        height: 1,
        marginVertical: 12,
    },
    backgroundPreview: {
        marginTop: 12,
        borderRadius: 8,
        overflow: "hidden",
    },
    backgroundImage: {
        width: "100%",
        height: 120,
        borderRadius: 8,
    },
    backgroundActions: {
        flexDirection: "row",
        marginTop: 12,
    },
    stickersGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        padding: 8,
        marginTop: 8,
    },
    stickerItemContainer: {
        width: "25%",
        aspectRatio: 1,
        padding: 4,
        position: "relative",
    },
    stickerItem: {
        width: "100%",
        height: "70%",
        borderRadius: 8,
        resizeMode: "contain",
    },
    stickerNameLabel: {
        fontSize: 9,
        textAlign: "center",
        marginTop: 2,
    },
    deleteStickerBtn: {
        position: "absolute",
        top: 0,
        right: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: 10,
    },
    aboutRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 4,
    },
    aboutLabel: {
        fontSize: 14,
    },
    aboutValue: {
        fontSize: 14,
    },
    linkRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    signOutSection: {
        marginTop: 32,
        marginBottom: 40,
    },
    modalOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        ...Platform.select({
            web: {
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
            },
        }),
    },
    confirmModal: {
        borderRadius: 16,
        padding: 24,
        maxWidth: 320,
        width: "90%",
        borderWidth: 1,
    },
    confirmTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 8,
    },
    confirmMessage: {
        fontSize: 14,
        marginBottom: 24,
        lineHeight: 20,
    },
    confirmButtons: {
        flexDirection: "row",
        gap: 12,
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: "center",
    },
    cancelButton: {
        borderWidth: 1,
        backgroundColor: "transparent",
    },
    signOutButton: {
        backgroundColor: "#ef4444",
    },
    confirmButtonText: {
        fontSize: 14,
        fontWeight: "600",
    },
    stickerNameInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        fontSize: 14,
    },
});