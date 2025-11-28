import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import emojiData from "../data/emojis.json";

const RECENT_EMOJIS_KEY = "@recent_emojis";
const MAX_RECENT = 24;

// Category configuration with icons
const CATEGORIES = [
  { key: "recent", icon: "🕐", name: "Recent" },
  { key: "Smileys & Emotion", icon: "😀", name: "Smileys" },
  { key: "People & Body", icon: "👋", name: "People" },
  { key: "Animals & Nature", icon: "🐶", name: "Animals" },
  { key: "Food & Drink", icon: "🍕", name: "Food" },
  { key: "Activities", icon: "⚽", name: "Activities" },
  { key: "Travel & Places", icon: "✈️", name: "Travel" },
  { key: "Objects", icon: "💡", name: "Objects" },
  { key: "Symbols", icon: "❤️", name: "Symbols" },
  { key: "Flags", icon: "🏳️", name: "Flags" },
];

// Flatten emoji data for easy access
const getAllEmojis = () => {
  const emojis = [];
  const categories = emojiData.emojis || {};
  
  Object.entries(categories).forEach(([category, subcategories]) => {
    if (category === "Component") return; // Skip component emojis (skin tones, etc.)
    Object.entries(subcategories).forEach(([subcategory, emojiList]) => {
      emojiList.forEach(e => {
        emojis.push({
          emoji: e.emoji,
          name: e.name,
          category,
          subcategory,
        });
      });
    });
  });
  
  return emojis;
};

const ALL_EMOJIS = getAllEmojis();

// Get emojis for a specific category
const getCategoryEmojis = (categoryKey) => {
  if (categoryKey === "recent") return [];
  const categoryData = emojiData.emojis?.[categoryKey];
  if (!categoryData) return [];
  
  const emojis = [];
  Object.values(categoryData).forEach(subcategoryEmojis => {
    subcategoryEmojis.forEach(e => emojis.push(e.emoji));
  });
  return emojis;
};

export default function EmojiPicker({ visible, onSelect, onClose }) {
  const { colors } = useTheme();
  const [category, setCategory] = useState("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentEmojis, setRecentEmojis] = useState([]);
  const screenWidth = Dimensions.get("window").width;
  const emojiSize = Math.floor((screenWidth - 32) / 8);

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
      const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, MAX_RECENT);
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

  // Get display emojis based on category and search
  const displayEmojis = useMemo(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return ALL_EMOJIS
        .filter(e => e.name.toLowerCase().includes(query))
        .slice(0, 100)
        .map(e => e.emoji);
    }
    
    if (category === "recent") {
      return recentEmojis;
    }
    
    return getCategoryEmojis(category);
  }, [category, searchQuery, recentEmojis]);

  if (!visible) return null;

  return (
    <View style={[styles.drawer, { backgroundColor: colors.surface, borderTopColor: colors.glassBorder }]}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text, backgroundColor: colors.glass }]}
          placeholder="Search emojis..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Category tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.categoryTabs}
        contentContainerStyle={styles.categoryTabsContent}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryTab,
              category === cat.key && { backgroundColor: colors.accent + "30" }
            ]}
            onPress={() => { setCategory(cat.key); setSearchQuery(""); }}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Emoji grid */}
      <ScrollView style={styles.emojiGrid} contentContainerStyle={styles.emojiGridContent}>
        {displayEmojis.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            {category === "recent" ? "No recent emojis" : "No emojis found"}
          </Text>
        ) : (
          <View style={styles.emojiRow}>
            {displayEmojis.map((emoji, index) => (
              <TouchableOpacity
                key={`${emoji}-${index}`}
                style={[styles.emojiBtn, { width: emojiSize, height: emojiSize }]}
                onPress={() => handleSelect(emoji)}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    height: 280,
    borderTopWidth: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 8,
  },
  searchIcon: {
    position: "absolute",
    left: 20,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 36,
    fontSize: 14,
  },
  closeBtn: {
    padding: 4,
  },
  categoryTabs: {
    maxHeight: 44,
  },
  categoryTabsContent: {
    paddingHorizontal: 8,
    gap: 4,
  },
  categoryTab: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIcon: {
    fontSize: 20,
  },
  emojiGrid: {
    flex: 1,
  },
  emojiGridContent: {
    padding: 8,
  },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  emojiBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 24,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
});
