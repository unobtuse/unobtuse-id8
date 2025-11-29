import React, {
    useState,
    useEffect,
    useMemo,
    useRef
} from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    SectionList,
    ScrollView,
    Image,
    ActivityIndicator,
    Platform,
} from "react-native";

const BlurView = Platform.OS !== "web" ? require("expo-blur").BlurView : View;
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    Ionicons
} from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
    useTheme
} from "../context/ThemeContext";
import {
    useToast
} from "../context/ToastContext";
import {
    api
} from "../services/api";
import emojiData from "../data/emojis.json";

const RECENT_EMOJIS_KEY = "@recent_emojis";
const MAX_RECENT = 24;

const EMOJI_CATEGORIES = [{
        key: "recent",
        icon: "🕐",
        name: "Frequently Used"
    },
    {
        key: "Smileys & Emotion",
        icon: "😀",
        name: "Smileys & Emotion"
    },
    {
        key: "People & Body",
        icon: "👋",
        name: "People & Body"
    },
    {
        key: "Animals & Nature",
        icon: "🐶",
        name: "Animals & Nature"
    },
    {
        key: "Food & Drink",
        icon: "🍕",
        name: "Food & Drink"
    },
    {
        key: "Activities",
        icon: "⚽",
        name: "Activities"
    },
    {
        key: "Travel & Places",
        icon: "✈️",
        name: "Travel & Places"
    },
    {
        key: "Objects",
        icon: "💡",
        name: "Objects"
    },
    {
        key: "Symbols",
        icon: "❤️",
        name: "Symbols"
    },
    {
        key: "Flags",
        icon: "🏳️",
        name: "Flags"
    },
];

const getEmojiSections = (recentEmojis) => {
    const sections = [];
    if (recentEmojis.length > 0) {
        sections.push({
            title: "Frequently Used",
            key: "recent",
            data: [recentEmojis],
            isGrid: true,
        });
    }
    const categories = emojiData.emojis || {};
    Object.entries(categories).forEach(([categoryKey, subcategories]) => {
        if (categoryKey === "Component") return;
        const config = EMOJI_CATEGORIES.find((c) => c.key === categoryKey);
        if (!config) return;
        const categoryEmojis = [];
        Object.values(subcategories).forEach((emojiList) => {
            emojiList.forEach((e) => categoryEmojis.push(e.emoji));
        });
        if (categoryEmojis.length > 0) {
            sections.push({
                title: config.name,
                key: categoryKey,
                data: [categoryEmojis],
                isGrid: true,
            });
        }
    });
    return sections.sort((a, b) => {
        const indexA = EMOJI_CATEGORIES.findIndex((c) => c.key === a.key);
        const indexB = EMOJI_CATEGORIES.findIndex((c) => c.key === b.key);
        return indexA - indexB;
    });
};

export default function MediaPicker({
    visible,
    onSelectEmoji,
    onSelectSticker,
    onClose
}) {
    const {
        colors
    } = useTheme();
    const {
        showToast
    } = useToast();
    const [activeTab, setActiveTab] = useState("emoji");

    // Emoji state
    const [searchQuery, setSearchQuery] = useState("");
    const [recentEmojis, setRecentEmojis] = useState([]);
    const [activeCategory, setActiveCategory] = useState("recent");
    const sectionListRef = useRef(null);

    // Sticker state
    const [stickers, setStickers] = useState([]);
    const [stickerLoading, setStickerLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [stickerSearch, setStickerSearch] = useState("");
    const [stickerName, setStickerName] = useState("");
    const [pendingFile, setPendingFile] = useState(null);
    const stickerInputRef = useRef(null);

    useEffect(() => {
        if (visible) {
            loadRecentEmojis();
            fetchStickers();
        }
    }, [visible]);

    // Emoji functions
    const loadRecentEmojis = async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_EMOJIS_KEY);
            if (stored) setRecentEmojis(JSON.parse(stored));
        } catch (error) {
            console.error("Failed to load recent emojis:", error);
        }
    };

    const saveRecentEmoji = async (emoji) => {
        try {
            const updated = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
            setRecentEmojis(updated);
            await AsyncStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
        } catch (error) {
            console.error("Failed to save recent emoji:", error);
        }
    };

    const handleSelectEmoji = (emoji) => {
        saveRecentEmoji(emoji);
        onSelectEmoji(emoji);
    };

    const emojiSections = useMemo(() => {
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const allEmojis = [];
            Object.entries(emojiData.emojis || {}).forEach(([cat, subcats]) => {
                if (cat === "Component") return;
                Object.values(subcats).forEach(list => {
                    list.forEach(e => {
                        if (e.name.toLowerCase().includes(query)) {
                            allEmojis.push(e.emoji);
                        }
                    });
                });
            });
            return [{
                title: "Search Results",
                key: "search",
                data: [allEmojis],
                isGrid: true
            }];
        }
        return getEmojiSections(recentEmojis);
    }, [recentEmojis, searchQuery]);

    const handleCategoryPress = (categoryKey) => {
        setActiveCategory(categoryKey);
        const sectionIndex = emojiSections.findIndex((s) => s.key === categoryKey);
        if (sectionIndex !== -1 && sectionListRef.current) {
            sectionListRef.current.scrollToLocation({
                sectionIndex,
                itemIndex: 0,
                animated: true,
            });
        }
    };

    // Sticker functions
    const fetchStickers = async () => {
        try {
            const data = await api.get('/stickers');
            setStickers(data);
        } catch (error) {
            console.error('Failed to fetch stickers:', error);
        } finally {
            setStickerLoading(false);
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
            mediaTypes: ['images', 'videos'],
            quality: 0.8,
        });
        if (!result.canceled) {
            setPendingFile(result.assets[0]);
            setStickerName("");
        }
    };

    const handleWebChange = async (event) => {
        const file = event.target.files?.[0];
        if (file) {
            setPendingFile(file);
            setStickerName("");
            if (stickerInputRef.current) stickerInputRef.current.value = '';
        }
    };

    const handleSaveSticker = async () => {
        if (!stickerName.trim()) {
            showToast('Please enter a name for your sticker', 'error');
            return;
        }
        if (!pendingFile) return;
        setUploading(true);
        try {
            const result = await api.uploadFile('/stickers', pendingFile, {
                name: stickerName.trim()
            });
            setStickers(prev => [result, ...prev]);
            showToast('Sticker added!', 'success');
            setPendingFile(null);
            setStickerName("");
        } catch (error) {
            showToast(error.message || 'Failed to upload sticker', 'error');
        } finally {
            setUploading(false);
        }
    };

    const cancelPendingSticker = () => {
        setPendingFile(null);
        setStickerName("");
    };

    const filteredStickers = stickerSearch ?
        stickers.filter(s => s.name?.toLowerCase().includes(stickerSearch.toLowerCase())) :
        stickers;

    const isVideo = (type) => type?.startsWith('video/');

    if (!visible) return null;

    const renderBlurContainer = (children) => {
        if (Platform.OS === "web") {
            return ( <
                div className = "backdrop-blur-xl"
                style = {
                    {
                        borderTop: `1px solid ${colors.glassBorder}`,
                        backgroundColor: colors.glass,
                        height: 350,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }
                } > {
                    children
                } <
                /div>
            );
        }
        return ( <
            View style = {
                [styles.container, {
                    borderTopColor: colors.glassBorder
                }]
            } >
            <
            BlurView intensity = {
                80
            }
            tint = "dark"
            style = {
                StyleSheet.absoluteFill
            }
            /> <
            View style = {
                [styles.blurOverlay, {
                    backgroundColor: colors.glass
                }]
            } > {
                children
            } <
            /View> <
            /View>
        );
    };

    // Sticker naming form
    if (pendingFile) {
        return renderBlurContainer( <
            >
            <
            View style = {
                styles.header
            } >
            <
            Text style = {
                [styles.title, {
                    color: colors.text
                }]
            } > Name Your Sticker < /Text> <
            TouchableOpacity onPress = {
                cancelPendingSticker
            }
            style = {
                styles.closeBtn
            } >
            <
            Ionicons name = "close"
            size = {
                20
            }
            color = {
                colors.textSecondary
            }
            /> <
            /TouchableOpacity> <
            /View> <
            View style = {
                styles.namingContainer
            } >
            <
            Text style = {
                [styles.namingHint, {
                    color: colors.textSecondary
                }]
            } >
            Type: {
                '{name}'
            }: in chat to use this sticker <
            /Text> <
            TextInput style = {
                [styles.nameInput, {
                    color: colors.text,
                    borderColor: colors.glassBorder,
                    backgroundColor: colors.surface
                }]
            }
            placeholder = "e.g., laughing-face"
            placeholderTextColor = {
                colors.textTertiary
            }
            value = {
                stickerName
            }
            onChangeText = {
                setStickerName
            }
            autoFocus autoCapitalize = "none" /
            >
            <
            View style = {
                styles.namingButtons
            } >
            <
            TouchableOpacity style = {
                [styles.namingBtn, {
                    borderColor: colors.glassBorder
                }]
            }
            onPress = {
                cancelPendingSticker
            } >
            <
            Text style = {
                [styles.namingBtnText, {
                    color: colors.text
                }]
            } > Cancel < /Text> <
            /TouchableOpacity> <
            TouchableOpacity style = {
                [styles.namingBtn, styles.saveBtnPrimary, {
                    backgroundColor: colors.accent
                }]
            }
            onPress = {
                handleSaveSticker
            }
            disabled = {
                uploading
            } > {
                uploading ? < ActivityIndicator size = "small"
                color = "#000" / > : < Text style = {
                        [styles.namingBtnText, {
                            color: "#000"
                        }]
                    } > Save < /Text>} <
                    /TouchableOpacity> <
                    /View> <
                    /View> <
                    />
            );
        }

        return renderBlurContainer( <
            > {
                /* Tabs */ } <
            View style = {
                [styles.tabBar, {
                    borderBottomColor: colors.glassBorder
                }]
            } >
            <
            TouchableOpacity style = {
                [styles.tab, activeTab === "emoji" && {
                    borderBottomColor: colors.accent,
                    borderBottomWidth: 2
                }]
            }
            onPress = {
                () => setActiveTab("emoji")
            } >
            <
            Text style = {
                [styles.tabText, {
                    color: activeTab === "emoji" ? colors.accent : colors.textSecondary
                }]
            } > 😀Emoji < /Text> <
            /TouchableOpacity> <
            TouchableOpacity style = {
                [styles.tab, activeTab === "sticker" && {
                    borderBottomColor: colors.accent,
                    borderBottomWidth: 2
                }]
            }
            onPress = {
                () => setActiveTab("sticker")
            } >
            <
            Text style = {
                [styles.tabText, {
                    color: activeTab === "sticker" ? colors.accent : colors.textSecondary
                }]
            } > 🖼️Stickers < /Text> <
            /TouchableOpacity> <
            View style = {
                {
                    flex: 1
                }
            }
            /> <
            TouchableOpacity onPress = {
                onClose
            }
            style = {
                styles.closeBtn
            } >
            <
            Ionicons name = "close"
            size = {
                20
            }
            color = {
                colors.textSecondary
            }
            /> <
            /TouchableOpacity> <
            /View>

            {
                activeTab === "emoji" ? ( <
                    > {
                        /* Emoji Search */ } <
                    View style = {
                        [styles.searchRow, {
                            backgroundColor: colors.glass
                        }]
                    } >
                    <
                    Ionicons name = "search"
                    size = {
                        16
                    }
                    color = {
                        colors.textTertiary
                    }
                    /> <
                    TextInput style = {
                        [styles.searchInput, {
                            color: colors.text
                        }]
                    }
                    placeholder = "Search emojis..."
                    placeholderTextColor = {
                        colors.textTertiary
                    }
                    value = {
                        searchQuery
                    }
                    onChangeText = {
                        setSearchQuery
                    }
                    /> {
                        searchQuery.length > 0 && ( <
                            TouchableOpacity onPress = {
                                () => setSearchQuery("")
                            } >
                            <
                            Ionicons name = "close-circle"
                            size = {
                                16
                            }
                            color = {
                                colors.textTertiary
                            }
                            /> <
                            /TouchableOpacity>
                        )
                    } <
                    /View>

                    <
                    View style = {
                        styles.contentContainer
                    } > {
                        /* Emoji Sidebar - Scrollable */ } <
                    ScrollView style = {
                        [styles.sidebar, {
                            borderRightColor: colors.glassBorder,
                            backgroundColor: colors.background
                        }]
                    }
                    showsVerticalScrollIndicator = {
                        false
                    }
                    contentContainerStyle = {
                        styles.sidebarContent
                    } >
                    {
                        EMOJI_CATEGORIES.map((cat) => ( <
                            TouchableOpacity key = {
                                cat.key
                            }
                            style = {
                                [styles.sidebarBtn, activeCategory === cat.key && {
                                    backgroundColor: colors.accent + "20",
                                    borderLeftColor: colors.accent
                                }]
                            }
                            onPress = {
                                () => handleCategoryPress(cat.key)
                            } >
                            <
                            Text style = {
                                styles.sidebarIcon
                            } > {
                                cat.icon
                            } < /Text> <
                            /TouchableOpacity>
                        ))
                    } <
                    /ScrollView>

                    {
                        /* Emoji List */ } <
                    SectionList ref = {
                        sectionListRef
                    }
                    sections = {
                        emojiSections
                    }
                    keyExtractor = {
                        (item, index) => `emoji-section-${index}`
                    }
                    renderItem = {
                        ({
                            item
                        }) => ( <
                            View style = {
                                styles.emojiGrid
                            } > {
                                item.map((emoji, index) => ( <
                                    TouchableOpacity key = {
                                        `${emoji}-${index}`
                                    }
                                    style = {
                                        styles.emojiBtn
                                    }
                                    onPress = {
                                        () => handleSelectEmoji(emoji)
                                    } >
                                    <
                                    Text style = {
                                        styles.emoji
                                    } > {
                                        emoji
                                    } < /Text> <
                                    /TouchableOpacity>
                                ))
                            } <
                            /View>
                        )
                    }
                    renderSectionHeader = {
                        ({
                            section: {
                                title
                            }
                        }) => ( <
                            View style = {
                                [styles.sectionHeader, {
                                    backgroundColor: colors.surface
                                }]
                            } >
                            <
                            Text style = {
                                [styles.sectionHeaderText, {
                                    color: colors.textSecondary
                                }]
                            } > {
                                title
                            } < /Text> <
                            /View>
                        )
                    }
                    stickySectionHeadersEnabled = {
                        false
                    }
                    contentContainerStyle = {
                        styles.listContent
                    }
                    showsVerticalScrollIndicator = {
                        true
                    }
                    style = {
                        styles.emojiList
                    }
                    onScrollToIndexFailed = {
                        (info) => {
                            setTimeout(() => {
                                if (sectionListRef.current) {
                                    sectionListRef.current.scrollToLocation({
                                        sectionIndex: info.index,
                                        itemIndex: 0,
                                        animated: true,
                                    });
                                }
                            }, 100);
                        }
                    }
                    /> <
                    /View> <
                    />
                ) : ( <
                    > {
                        /* Sticker Search */ } <
                    View style = {
                        [styles.searchRow, {
                            backgroundColor: colors.glass
                        }]
                    } >
                    <
                    Ionicons name = "search"
                    size = {
                        16
                    }
                    color = {
                        colors.textTertiary
                    }
                    /> <
                    TextInput style = {
                        [styles.searchInput, {
                            color: colors.text
                        }]
                    }
                    placeholder = "Search stickers..."
                    placeholderTextColor = {
                        colors.textTertiary
                    }
                    value = {
                        stickerSearch
                    }
                    onChangeText = {
                        setStickerSearch
                    }
                    /> {
                        stickerSearch.length > 0 && ( <
                            TouchableOpacity onPress = {
                                () => setStickerSearch("")
                            } >
                            <
                            Ionicons name = "close-circle"
                            size = {
                                16
                            }
                            color = {
                                colors.textTertiary
                            }
                            /> <
                            /TouchableOpacity>
                        )
                    } <
                    TouchableOpacity onPress = {
                        handleAddSticker
                    }
                    style = {
                        styles.addBtn
                    } >
                    <
                    Ionicons name = "add-circle-outline"
                    size = {
                        22
                    }
                    color = {
                        colors.accent
                    }
                    /> <
                    /TouchableOpacity> <
                    /View>

                    {
                        stickerLoading ? ( <
                            View style = {
                                styles.loadingContainer
                            } >
                            <
                            ActivityIndicator color = {
                                colors.accent
                            }
                            /> <
                            /View>
                        ) : filteredStickers.length === 0 ? ( <
                            View style = {
                                styles.emptyContainer
                            } >
                            <
                            Ionicons name = "images-outline"
                            size = {
                                32
                            }
                            color = {
                                colors.textTertiary
                            }
                            /> <
                            Text style = {
                                [styles.emptyText, {
                                    color: colors.textSecondary
                                }]
                            } > {
                                stickerSearch ? "No stickers found" : "No stickers yet"
                            } <
                            /Text> {
                                !stickerSearch && ( <
                                    TouchableOpacity onPress = {
                                        handleAddSticker
                                    }
                                    style = {
                                        [styles.addStickerBtn, {
                                            backgroundColor: colors.accent
                                        }]
                                    } >
                                    <
                                    Text style = {
                                        styles.addStickerBtnText
                                    } > Add Sticker < /Text> <
                                    /TouchableOpacity>
                                )
                            } <
                            /View>
                        ) : ( <
                            ScrollView style = {
                                styles.stickerGrid
                            }
                            contentContainerStyle = {
                                styles.stickerGridContent
                            }
                            showsVerticalScrollIndicator = {
                                false
                            }
                            keyboardShouldPersistTaps = "handled" >
                            <
                            View style = {
                                styles.stickerRow
                            } > {
                                filteredStickers.map((sticker) => ( <
                                    TouchableOpacity key = {
                                        sticker.id
                                    }
                                    onPress = {
                                        () => onSelectSticker(sticker)
                                    }
                                    style = {
                                        styles.stickerItem
                                    } > {
                                        isVideo(sticker.file_type) ? ( <
                                            View style = {
                                                [styles.stickerMedia, styles.videoPlaceholder]
                                            } >
                                            <
                                            Ionicons name = "videocam"
                                            size = {
                                                24
                                            }
                                            color = "#fff" / >
                                            <
                                            /View>
                                        ) : ( <
                                            Image source = {
                                                {
                                                    uri: sticker.file_url
                                                }
                                            }
                                            style = {
                                                styles.stickerMedia
                                            }
                                            resizeMode = "contain" / >
                                        )
                                    } <
                                    Text style = {
                                        [styles.stickerName, {
                                            color: colors.textTertiary
                                        }]
                                    }
                                    numberOfLines = {
                                        1
                                    } >: {
                                        sticker.name
                                    }: < /Text> <
                                    /TouchableOpacity>
                                ))
                            } <
                            /View> <
                            /ScrollView>
                        )
                    } <
                    />
                )
            }

            {
                Platform.OS === 'web' && ( <
                    input type = "file"
                    ref = {
                        stickerInputRef
                    }
                    style = {
                        {
                            display: 'none'
                        }
                    }
                    accept = "image/*,video/*,.gif"
                    onChange = {
                        handleWebChange
                    }
                    />
                )
            } <
            />
        );
    }

    const styles = StyleSheet.create({
        container: {
            height: 350,
            borderTopWidth: 1,
            overflow: "hidden",
        },
        blurOverlay: {
            flex: 1,
        },
        tabBar: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
            borderBottomWidth: 1,
        },
        tab: {
            paddingVertical: 10,
            paddingHorizontal: 16,
        },
        tabText: {
            fontSize: 14,
            fontWeight: "600",
        },
        closeBtn: {
            padding: 8,
        },
        searchRow: {
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: 12,
            marginVertical: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            gap: 6,
        },
        searchInput: {
            flex: 1,
            fontSize: 14,
            padding: 0,
        },
        addBtn: {
            padding: 4,
        },
        contentContainer: {
            flex: 1,
            flexDirection: "row",
        },
        sidebar: {
            width: 40,
            maxWidth: 40,
            flexGrow: 0,
            borderRightWidth: 1,
        },
        sidebarContent: {
            alignItems: "center",
            paddingVertical: 4,
        },
        sidebarBtn: {
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            borderLeftWidth: 3,
            borderLeftColor: "transparent",
        },
        sidebarIcon: {
            fontSize: 18,
        },
        listContent: {
            paddingBottom: 20,
        },
        emojiList: {
            flex: 1,
        },
        sectionHeader: {
            paddingHorizontal: 12,
            paddingVertical: 6,
        },
        sectionHeaderText: {
            fontSize: 11,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        emojiGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: 4,
        },
        emojiBtn: {
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
        },
        emoji: {
            fontSize: 24,
        },
        // Sticker styles
        loadingContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptyContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptyText: {
            fontSize: 14,
            marginTop: 8,
            marginBottom: 12,
        },
        addStickerBtn: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
        },
        addStickerBtnText: {
            color: "#000",
            fontWeight: "600",
            fontSize: 14,
        },
        stickerGrid: {
            flex: 1,
            paddingHorizontal: 8,
        },
        stickerGridContent: {
            paddingBottom: 16,
        },
        stickerRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        stickerItem: {
            width: '25%',
            padding: 4,
            alignItems: 'center',
        },
        stickerMedia: {
            width: 70,
            height: 70,
            borderRadius: 8,
        },
        stickerName: {
            fontSize: 9,
            marginTop: 2,
            textAlign: 'center',
        },
        videoPlaceholder: {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.2)',
        },
        // Naming form
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        title: {
            fontSize: 16,
            fontWeight: '600',
        },
        namingContainer: {
            padding: 16,
        },
        namingHint: {
            fontSize: 13,
            marginBottom: 12,
            textAlign: 'center',
        },
        nameInput: {
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            fontSize: 14,
        },
        namingButtons: {
            flexDirection: 'row',
            gap: 12,
        },
        namingBtn: {
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
        },
        saveBtnPrimary: {
            borderWidth: 0,
        },
        namingBtnText: {
            fontSize: 14,
            fontWeight: '600',
        },
    });