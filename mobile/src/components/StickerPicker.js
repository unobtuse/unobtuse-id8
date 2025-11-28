import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';

export default function StickerPicker({ visible, onSelect, onClose }) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [stickers, setStickers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stickerName, setStickerName] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const stickerInputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      fetchStickers();
    }
  }, [visible]);

  const fetchStickers = async () => {
    try {
      const data = await api.get('/stickers');
      setStickers(data);
    } catch (error) {
      console.error('Failed to fetch stickers:', error);
    } finally {
      setLoading(false);
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
      const result = await api.uploadFile('/stickers', pendingFile, { name: stickerName.trim() });
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

  if (!visible) return null;

  const isVideo = (type) => type?.startsWith('video/');
  
  // Filter stickers by search query
  const filteredStickers = searchQuery
    ? stickers.filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : stickers;

  // If we have a pending file, show the naming form
  if (pendingFile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.glass, borderTopColor: colors.glassBorder }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Name Your Sticker</Text>
          <TouchableOpacity onPress={cancelPendingSticker} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.namingContainer}>
          <Text style={[styles.namingHint, { color: colors.textSecondary }]}>
            Type :{'{name}'}: in chat to use this sticker
          </Text>
          <TextInput
            style={[styles.nameInput, { 
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
          <View style={styles.namingButtons}>
            <TouchableOpacity
              style={[styles.namingBtn, { borderColor: colors.glassBorder }]}
              onPress={cancelPendingSticker}
            >
              <Text style={[styles.namingBtnText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.namingBtn, styles.saveBtnPrimary, { backgroundColor: colors.accent }]}
              onPress={handleSaveSticker}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={[styles.namingBtnText, { color: "#000" }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.glass, borderTopColor: colors.glassBorder }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>Stickers</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleAddSticker} style={styles.addBtn}>
            <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search stickers..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : filteredStickers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={32} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {searchQuery ? "No stickers found" : "No stickers yet"}
          </Text>
          {!searchQuery && (
            <TouchableOpacity onPress={handleAddSticker} style={[styles.addStickerBtn, { backgroundColor: colors.accent }]}>
              <Text style={styles.addStickerBtnText}>Add Sticker</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView 
          style={styles.grid}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stickerRow}>
            {filteredStickers.map((sticker) => (
              <TouchableOpacity 
                key={sticker.id}
                onPress={() => onSelect(sticker)} 
                style={styles.stickerItem}
              >
                {isVideo(sticker.file_type) ? (
                  <View style={[styles.stickerMedia, styles.videoPlaceholder]}>
                    <Ionicons name="videocam" size={24} color="#fff" />
                  </View>
                ) : (
                  <Image 
                    source={{ uri: sticker.file_url }} 
                    style={styles.stickerMedia}
                    resizeMode="contain"
                  />
                )}
                <Text 
                  style={[styles.stickerName, { color: colors.textTertiary }]}
                  numberOfLines={1}
                >
                  :{sticker.name}:
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={stickerInputRef}
          style={{ display: 'none' }}
          accept="image/*,video/*,.gif"
          onChange={handleWebChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    maxHeight: 320,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  addBtn: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginBottom: 8,
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
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
  grid: {
    flex: 1,
    paddingHorizontal: 8,
  },
  gridContent: {
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
    width: 100,
    height: 100,
    maxWidth: 100,
    maxHeight: 100,
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
  // Naming form styles
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
