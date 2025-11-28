import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { api } from "../services/api";

// Common emoji shortcuts with names for autocomplete
const EMOJI_SHORTCUTS = [
  { name: "smile", emoji: "😊" },
  { name: "happy", emoji: "😀" },
  { name: "grin", emoji: "😁" },
  { name: "laugh", emoji: "😂" },
  { name: "lol", emoji: "🤣" },
  { name: "joy", emoji: "😂" },
  { name: "love", emoji: "❤️" },
  { name: "heart", emoji: "❤️" },
  { name: "hearts", emoji: "💕" },
  { name: "fire", emoji: "🔥" },
  { name: "hot", emoji: "🔥" },
  { name: "lit", emoji: "🔥" },
  { name: "thumbsup", emoji: "👍" },
  { name: "thumbs-up", emoji: "👍" },
  { name: "+1", emoji: "👍" },
  { name: "like", emoji: "👍" },
  { name: "thumbsdown", emoji: "👎" },
  { name: "thumbs-down", emoji: "👎" },
  { name: "-1", emoji: "👎" },
  { name: "dislike", emoji: "👎" },
  { name: "clap", emoji: "👏" },
  { name: "applause", emoji: "👏" },
  { name: "party", emoji: "🎉" },
  { name: "tada", emoji: "🎉" },
  { name: "celebrate", emoji: "🎉" },
  { name: "confetti", emoji: "🎊" },
  { name: "sparkles", emoji: "✨" },
  { name: "magic", emoji: "✨" },
  { name: "star", emoji: "⭐" },
  { name: "100", emoji: "💯" },
  { name: "perfect", emoji: "💯" },
  { name: "check", emoji: "✅" },
  { name: "done", emoji: "✅" },
  { name: "yes", emoji: "✅" },
  { name: "x", emoji: "❌" },
  { name: "no", emoji: "❌" },
  { name: "wrong", emoji: "❌" },
  { name: "wave", emoji: "👋" },
  { name: "hello", emoji: "👋" },
  { name: "hi", emoji: "👋" },
  { name: "bye", emoji: "👋" },
  { name: "pray", emoji: "🙏" },
  { name: "please", emoji: "🙏" },
  { name: "thanks", emoji: "🙏" },
  { name: "eyes", emoji: "👀" },
  { name: "look", emoji: "👀" },
  { name: "think", emoji: "🤔" },
  { name: "thinking", emoji: "🤔" },
  { name: "hmm", emoji: "🤔" },
  { name: "sad", emoji: "😢" },
  { name: "cry", emoji: "😭" },
  { name: "sob", emoji: "😭" },
  { name: "angry", emoji: "😠" },
  { name: "mad", emoji: "😡" },
  { name: "rage", emoji: "😡" },
  { name: "cool", emoji: "😎" },
  { name: "sunglasses", emoji: "😎" },
  { name: "awesome", emoji: "😎" },
  { name: "wink", emoji: "😉" },
  { name: "tongue", emoji: "😛" },
  { name: "crazy", emoji: "🤪" },
  { name: "kiss", emoji: "😘" },
  { name: "hug", emoji: "🤗" },
  { name: "shrug", emoji: "🤷" },
  { name: "facepalm", emoji: "🤦" },
  { name: "rocket", emoji: "🚀" },
  { name: "launch", emoji: "🚀" },
  { name: "boom", emoji: "💥" },
  { name: "explosion", emoji: "💥" },
  { name: "zap", emoji: "⚡" },
  { name: "lightning", emoji: "⚡" },
  { name: "bulb", emoji: "💡" },
  { name: "idea", emoji: "💡" },
  { name: "warning", emoji: "⚠️" },
  { name: "caution", emoji: "⚠️" },
  { name: "question", emoji: "❓" },
  { name: "what", emoji: "❓" },
  { name: "exclaim", emoji: "❗" },
  { name: "important", emoji: "❗" },
  { name: "ok", emoji: "👌" },
  { name: "okay", emoji: "👌" },
  { name: "perfect", emoji: "👌" },
  { name: "muscle", emoji: "💪" },
  { name: "strong", emoji: "💪" },
  { name: "flex", emoji: "💪" },
  { name: "brain", emoji: "🧠" },
  { name: "smart", emoji: "🧠" },
  { name: "coffee", emoji: "☕" },
  { name: "cafe", emoji: "☕" },
  { name: "beer", emoji: "🍺" },
  { name: "cheers", emoji: "🍻" },
  { name: "wine", emoji: "🍷" },
  { name: "pizza", emoji: "🍕" },
  { name: "burger", emoji: "🍔" },
  { name: "taco", emoji: "🌮" },
  { name: "poop", emoji: "💩" },
  { name: "poo", emoji: "💩" },
  { name: "ghost", emoji: "👻" },
  { name: "boo", emoji: "👻" },
  { name: "skull", emoji: "💀" },
  { name: "dead", emoji: "💀" },
  { name: "alien", emoji: "👽" },
  { name: "ufo", emoji: "👽" },
  { name: "robot", emoji: "🤖" },
  { name: "bot", emoji: "🤖" },
  { name: "dog", emoji: "🐶" },
  { name: "puppy", emoji: "🐶" },
  { name: "cat", emoji: "🐱" },
  { name: "kitty", emoji: "🐱" },
  { name: "monkey", emoji: "🐵" },
  { name: "see-no-evil", emoji: "🙈" },
  { name: "hear-no-evil", emoji: "🙉" },
  { name: "speak-no-evil", emoji: "🙊" },
  { name: "unicorn", emoji: "🦄" },
  { name: "rainbow", emoji: "🌈" },
  { name: "sun", emoji: "☀️" },
  { name: "moon", emoji: "🌙" },
  { name: "rain", emoji: "🌧️" },
  { name: "snow", emoji: "❄️" },
  { name: "cold", emoji: "🥶" },
  { name: "sleeping", emoji: "😴" },
  { name: "zzz", emoji: "💤" },
  { name: "tired", emoji: "😫" },
  { name: "sick", emoji: "🤢" },
  { name: "nerd", emoji: "🤓" },
  { name: "money", emoji: "🤑" },
  { name: "rich", emoji: "🤑" },
  { name: "angel", emoji: "😇" },
  { name: "devil", emoji: "😈" },
  { name: "evil", emoji: "😈" },
  { name: "broken-heart", emoji: "💔" },
  { name: "gift", emoji: "🎁" },
  { name: "present", emoji: "🎁" },
  { name: "trophy", emoji: "🏆" },
  { name: "winner", emoji: "🏆" },
  { name: "medal", emoji: "🥇" },
  { name: "gold", emoji: "🥇" },
  { name: "music", emoji: "🎵" },
  { name: "notes", emoji: "🎶" },
  { name: "phone", emoji: "📱" },
  { name: "computer", emoji: "💻" },
  { name: "camera", emoji: "📷" },
  { name: "photo", emoji: "📷" },
  { name: "lock", emoji: "🔒" },
  { name: "key", emoji: "🔑" },
  { name: "bell", emoji: "🔔" },
  { name: "ring", emoji: "💍" },
];

export default function AutocompleteMenu({ 
  query, 
  onSelect, 
  onStickerSelect,
  visible 
}) {
  const { colors } = useTheme();
  const [stickers, setStickers] = useState([]);
  const [emojis, setEmojis] = useState([]);

  useEffect(() => {
    if (!query || query.length < 1) {
      setStickers([]);
      setEmojis([]);
      return;
    }

    // Search emojis locally
    const matchingEmojis = EMOJI_SHORTCUTS.filter(e => 
      e.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
    setEmojis(matchingEmojis);

    // Search stickers from API
    const searchStickers = async () => {
      try {
        const results = await api.get(`/stickers/search?q=${encodeURIComponent(query)}`);
        setStickers(results.slice(0, 5));
      } catch (error) {
        console.error("Failed to search stickers:", error);
      }
    };
    searchStickers();
  }, [query]);

  if (!visible || (!stickers.length && !emojis.length)) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
      <ScrollView 
        horizontal={false} 
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {emojis.map((item, index) => (
          <TouchableOpacity
            key={`emoji-${index}`}
            style={styles.item}
            onPress={() => onSelect(item.emoji, item.name)}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={[styles.name, { color: colors.text }]}>:{item.name}:</Text>
          </TouchableOpacity>
        ))}
        {stickers.map((sticker) => (
          <TouchableOpacity
            key={`sticker-${sticker.id}`}
            style={styles.item}
            onPress={() => onStickerSelect(sticker)}
          >
            <Image source={{ uri: sticker.file_url }} style={styles.stickerThumb} />
            <Text style={[styles.name, { color: colors.text }]}>:{sticker.name}:</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: "100%",
    left: 8,
    right: 8,
    maxHeight: 200,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
    overflow: "hidden",
  },
  scroll: {
    padding: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  emoji: {
    fontSize: 24,
    width: 32,
    textAlign: "center",
  },
  stickerThumb: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  name: {
    fontSize: 14,
  },
});
