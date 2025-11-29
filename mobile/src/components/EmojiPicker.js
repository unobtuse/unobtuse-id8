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
    Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    Ionicons
} from "@expo/vector-icons";
import {
    useTheme
} from "../context/ThemeContext";
import emojiData from "../data/emojis.json";

const RECENT_EMOJIS_KEY = "@recent_emojis";
const MAX_RECENT = 24;
const EMOJI_SIZE = 36;
const NUM_COLUMNS = 7;

// Category configuration with icons
const CATEGORIES = [{
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

// Helper to process emoji data into sections
const getSections = (recentEmojis) => {
    const sections = [];

    // 1. Recent Section
    if (recentEmojis.length > 0) {
        sections.push({
            title: "Frequently Used",
            key: "recent",
            data: [recentEmojis], // Array of rows (we'll just have one item which is the array of emojis for grid rendering)
            isGrid: true,
        });
    }

    // 2. Other Categories
    const categories = emojiData.emojis || {};
    Object.entries(categories).forEach(([categoryKey, subcategories]) => {
        if (categoryKey === "Component") return;

        // Check if this category is in our supported list to maintain order/icons
        const config = CATEGORIES.find((c) => c.key === categoryKey);
        if (!config) return;

        const categoryEmojis = [];
        Object.values(subcategories).forEach((emojiList) => {
            emojiList.forEach((e) => categoryEmojis.push(e.emoji));
        });

        if (categoryEmojis.length > 0) {
            sections.push({
                title: config.name,
                key: categoryKey,
                data: [categoryEmojis], // Pass as a single item to render a custom grid cell
                isGrid: true,
            });
        }
    });

    // Sort sections based on CATEGORIES order
    return sections.sort((a, b) => {
        const indexA = CATEGORIES.findIndex((c) => c.key === a.key);
        const indexB = CATEGORIES.findIndex((c) => c.key === b.key);
        return indexA - indexB;
    });
};

export default function EmojiPicker({
    visible,
    onSelect,
    onClose
}) {
    const {
        colors
    } = useTheme();
    const [searchQuery, setSearchQuery] = useState("");
    const [recentEmojis, setRecentEmojis] = useState([]);
    const [activeCategory, setActiveCategory] = useState("recent");
    const sectionListRef = useRef(null);

    useEffect(() => {
        loadRecentEmojis();
    }, []);

    const loadRecentEmojis = async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_EMOJIS_KEY);
            if (stored) {
                setRecentEmojis(JSON.parse(stored));
            }
        } catch (error) {
            console.error("Failed to load recent emojis:", error);
        }
    };

    const saveRecentEmoji = async (emoji) => {
        try {
            const updated = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(
                0,
                MAX_RECENT
            );
            setRecentEmojis(updated);
            await AsyncStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
        } catch (error) {
            console.error("Failed to save recent emoji:", error);
        }
    };

    const handleSelect = (emoji) => {
        saveRecentEmoji(emoji);
        onSelect(emoji);
    };

    const sections = useMemo(() => {
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const allEmojis = [];

            // Flatten all emojis for search
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
        return getSections(recentEmojis);
    }, [recentEmojis, searchQuery]);

    const handleCategoryPress = (categoryKey) => {
        setActiveCategory(categoryKey);
        const sectionIndex = sections.findIndex((s) => s.key === categoryKey);
        if (sectionIndex !== -1 && sectionListRef.current) {
            sectionListRef.current.scrollToLocation({
                sectionIndex,
                itemIndex: 0,
                animated: true,
            });
        }
    };

    const onViewableItemsChanged = useRef(({
        viewableItems
    }) => {
        if (viewableItems.length > 0) {
            const firstVisible = viewableItems[0];
            if (firstVisible.section) {
                setActiveCategory(firstVisible.section.key);
            }
        }
    }).current;

    const renderSectionHeader = ({
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
        } <
        /Text> < /
        View >
    );

    const renderItem = ({
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
                    () => handleSelect(emoji)
                } >
                <
                Text style = {
                    styles.emoji
                } > {
                    emoji
                } < /Text> < /
                TouchableOpacity >
            ))
        } <
        /View>
    );

    if (!visible) return null;

    return ( <
        View style = {
            [
                styles.container,
                {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.glassBorder
                },
            ]
        } > {
            /* Search Bar */
        } <
        View style = {
            [styles.searchContainer, {
                borderBottomColor: colors.glassBorder
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
        style = {
            styles.searchIcon
        }
        /> <
        TextInput style = {
            [
                styles.searchInput,
                {
                    color: colors.text,
                    backgroundColor: colors.glass
                },
            ]
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
        /> < /
        TouchableOpacity > <
        /View>

        <
        View style = {
            styles.contentContainer
        } > {
            /* Sidebar */
        } <
        View style = {
            [styles.sidebar, {
                borderRightColor: colors.glassBorder,
                backgroundColor: colors.background
            }]
        } > {
            CATEGORIES.map((cat) => ( <
                TouchableOpacity key = {
                    cat.key
                }
                style = {
                    [
                        styles.sidebarBtn,
                        activeCategory === cat.key && {
                            backgroundColor: colors.accent + "20",
                            borderLeftColor: colors.accent,
                        },
                    ]
                }
                onPress = {
                    () => handleCategoryPress(cat.key)
                } >
                <
                Text style = {
                    styles.sidebarIcon
                } > {
                    cat.icon
                } < /Text> < /
                TouchableOpacity >
            ))
        } <
        /View>

        {
            /* Main List */
        } <
        SectionList ref = {
            sectionListRef
        }
        sections = {
            sections
        }
        keyExtractor = {
            (item, index) => index.toString()
        }
        renderItem = {
            renderItem
        }
        renderSectionHeader = {
            renderSectionHeader
        }
        stickySectionHeadersEnabled = {
            false
        }
        onViewableItemsChanged = {
            onViewableItemsChanged
        }
        viewabilityConfig = {
            {
                itemVisiblePercentThreshold: 10,
                minimumViewTime: 0,
            }
        }
        contentContainerStyle = {
            styles.listContent
        }
        showsVerticalScrollIndicator = {
            true
        }
        /> < /
        View > <
        /View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 350,
        borderTopWidth: 1,
        overflow: "hidden",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        gap: 8,
        borderBottomWidth: 1,
    },
    searchIcon: {
        position: "absolute",
        left: 24,
        zIndex: 1,
    },
    searchInput: {
        flex: 1,
        height: 36,
        borderRadius: 4,
        paddingHorizontal: 36,
        fontSize: 14,
    },
    closeBtn: {
        padding: 4,
    },
    contentContainer: {
        flex: 1,
        flexDirection: "row",
    },
    sidebar: {
        width: 40,
        borderRightWidth: 1,
        alignItems: "center",
        paddingVertical: 8,
    },
    sidebarBtn: {
        width: 40,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        borderLeftWidth: 3,
        borderLeftColor: "transparent",
        marginBottom: 2,
    },
    sidebarIcon: {
        fontSize: 20,
    },
    listContent: {
        paddingBottom: 20,
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    sectionHeaderText: {
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    emojiGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 8,
    },
    emojiBtn: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    emoji: {
        fontSize: 26,
    },
});