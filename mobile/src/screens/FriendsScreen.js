import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import BackgroundWrapper from "../components/BackgroundWrapper";
import GlassCard from "../components/GlassCard";
import Button from "../components/Button";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";

export default function FriendsScreen({ navigation }) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("updates");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [threadUpdates, setThreadUpdates] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [friendsRes, requestsRes, sentRes, activityRes] = await Promise.all([
        api.get("/friends"),
        api.get("/friends/requests"),
        api.get("/friends/requests/sent"),
        api.get("/replies/activity"),
      ]);
      setFriends(friendsRes);
      setRequests(requestsRes);
      setSentRequests(sentRes);
      setThreadUpdates(activityRes);
    } catch (error) {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await api.get(
        `/friends/search?q=${encodeURIComponent(query)}`,
      );
      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      await api.post("/friends/request", { userId });
      showToast("Friend request sent", "success");
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, has_request: true, friend_status: "pending" }
            : u,
        ),
      );
      loadData();
    } catch (error) {
      showToast(error.message || "Failed to send request", "error");
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await api.patch(`/friends/${requestId}/accept`);
      showToast("Friend request accepted", "success");
      loadData();
    } catch (error) {
      showToast("Failed to accept request", "error");
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.delete(`/friends/request/${requestId}`);
      showToast("Request declined", "success");
      loadData();
    } catch (error) {
      showToast("Failed to decline request", "error");
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      await api.delete(`/friends/request/${requestId}`);
      showToast("Request cancelled", "success");
      loadData();
    } catch (error) {
      showToast("Failed to cancel request", "error");
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      await api.delete(`/friends/${friendId}`);
      showToast("Friend removed", "success");
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch (error) {
      showToast("Failed to remove friend", "error");
    }
  };

  const handleThreadUpdatePress = async (update) => {
    // Mark as read
    try {
      await api.post("/replies/read", { replyIds: [update.id] });
      setThreadUpdates(prev => 
        prev.map(u => u.id === update.id ? { ...u, user_read_at: new Date().toISOString() } : u)
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
    // Navigate to thread
    navigation.navigate("IdeaDetail", { ideaId: update.idea_id });
  };

  const getTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadUpdates = threadUpdates.filter(u => !u.user_read_at);

  const renderFriend = ({ item, index }) => (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(300)}>
      <GlassCard style={styles.friendCard}>
        <View style={styles.friendInfo}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.avatarText}>
                {item.name?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.friendDetails}>
            <Text style={[styles.friendName, { color: colors.text }]}>
              {item.name}
            </Text>
            {item.screen_name && (
              <Text style={[styles.screenName, { color: colors.accent }]}>
                @{item.screen_name}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.removeButton, { borderColor: colors.glassBorder }]}
          onPress={() => handleRemoveFriend(item.id)}
        >
          <Ionicons
            name="person-remove-outline"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </GlassCard>
    </Animated.View>
  );

  const renderRequest = ({ item, index }) => (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(300)}>
      <GlassCard style={styles.friendCard}>
        <View style={styles.friendInfo}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.avatarText}>
                {item.name?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.friendDetails}>
            <Text style={[styles.friendName, { color: colors.text }]}>
              {item.name}
            </Text>
            {item.screen_name && (
              <Text style={[styles.screenName, { color: colors.accent }]}>
                @{item.screen_name}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.accent }]}
            onPress={() => handleAcceptRequest(item.id)}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { borderColor: colors.glassBorder, borderWidth: 1 },
            ]}
            onPress={() => handleRejectRequest(item.id)}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderSentRequest = ({ item, index }) => (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(300)}>
      <GlassCard style={styles.friendCard}>
        <View style={styles.friendInfo}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.avatarText}>
                {item.name?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.friendDetails}>
            <Text style={[styles.friendName, { color: colors.text }]}>
              {item.name}
            </Text>
            {item.screen_name && (
              <Text style={[styles.screenName, { color: colors.accent }]}>
                @{item.screen_name}
              </Text>
            )}
            <Text style={[styles.pendingLabel, { color: colors.textTertiary }]}>
              Pending
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.removeButton, { borderColor: colors.glassBorder }]}
          onPress={() => handleCancelRequest(item.id)}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </GlassCard>
    </Animated.View>
  );

  const renderSearchResult = ({ item, index }) => {
    const isPending = item.friend_status === "pending";
    const isFriend = item.friend_status === "accepted";

    return (
      <Animated.View entering={FadeInUp.delay(index * 50).duration(300)}>
        <GlassCard style={styles.friendCard}>
          <View style={styles.friendInfo}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={styles.avatarText}>
                  {item.name?.charAt(0)?.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.friendDetails}>
              <Text style={[styles.friendName, { color: colors.text }]}>
                {item.name}
              </Text>
              {item.screen_name && (
                <Text style={[styles.screenName, { color: colors.accent }]}>
                  @{item.screen_name}
                </Text>
              )}
            </View>
          </View>
          {isFriend ? (
            <View
              style={[styles.statusBadge, { backgroundColor: colors.surface }]}
            >
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.accent}
              />
              <Text style={[styles.statusText, { color: colors.accent }]}>
                Friends
              </Text>
            </View>
          ) : isPending ? (
            <View
              style={[styles.statusBadge, { backgroundColor: colors.surface }]}
            >
              <Text
                style={[styles.statusText, { color: colors.textSecondary }]}
              >
                Pending
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.accent }]}
              onPress={() => handleSendRequest(item.id)}
            >
              <Ionicons name="person-add" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </GlassCard>
      </Animated.View>
    );
  };

  const renderThreadUpdate = ({ item, index }) => {
    const isUnread = !item.user_read_at;
    const isSticker = item.content?.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i) || 
                      item.content?.includes('/stickers/');
    
    return (
      <Animated.View entering={FadeInUp.delay(index * 50).duration(300)}>
        <TouchableOpacity onPress={() => handleThreadUpdatePress(item)}>
          <GlassCard style={[styles.friendCard, isUnread && styles.unreadCard]}>
            <View style={styles.friendInfo}>
              {item.author_avatar ? (
                <Image source={{ uri: item.author_avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <Text style={styles.avatarText}>
                    {item.author_name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.friendDetails}>
                <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
                  {item.idea_title}
                </Text>
                <Text style={[styles.updateContent, { color: colors.textSecondary }]} numberOfLines={1}>
                  <Text style={{ fontWeight: '600' }}>{item.author_name}: </Text>
                  {isSticker ? '📷 Sticker' : (item.content || 'Shared something')}
                </Text>
              </View>
            </View>
            <View style={styles.updateMeta}>
              <Text style={[styles.timeAgo, { color: colors.textTertiary }]}>
                {getTimeAgo(item.created_at)}
              </Text>
              {isUnread && (
                <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
              )}
            </View>
          </GlassCard>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={
          activeTab === "updates"
            ? "chatbubbles-outline"
            : activeTab === "friends"
              ? "people-outline"
              : activeTab === "requests"
                ? "mail-outline"
                : "search-outline"
        }
        size={48}
        color={colors.textTertiary}
      />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        {activeTab === "updates"
          ? "No thread updates"
          : activeTab === "friends"
            ? "No friends yet"
            : activeTab === "requests"
              ? "No pending requests"
              : "No sent requests"}
      </Text>
      {activeTab === "friends" && (
        <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
          Search for friends by username or email above
        </Text>
      )}
    </View>
  );

  const data =
    activeTab === "updates"
      ? threadUpdates
      : activeTab === "friends"
        ? friends
        : activeTab === "requests"
          ? requests
          : sentRequests;
  const renderItem =
    activeTab === "updates"
      ? renderThreadUpdate
      : activeTab === "friends"
        ? renderFriend
        : activeTab === "requests"
          ? renderRequest
          : renderSentRequest;

  return (
    <BackgroundWrapper>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            <Ionicons name="arrow-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Friends</Text>
          <View style={{ width: 44 }} />
        </View>

        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.searchContainer}
        >
          <View
            style={[
              styles.searchInputWrapper,
              { backgroundColor: colors.glass },
            ]}
          >
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by @username or email"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {searchQuery.length >= 2 ? (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  {searching ? "Searching..." : "No users found"}
                </Text>
              </View>
            }
          />
        ) : (
          <>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "updates" && {
                    borderBottomColor: colors.accent,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setActiveTab("updates")}
              >
                <View style={styles.tabWithBadge}>
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          activeTab === "updates"
                            ? colors.text
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    Updates
                  </Text>
                  {unreadUpdates.length > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.badgeText}>{unreadUpdates.length}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "friends" && {
                    borderBottomColor: colors.accent,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setActiveTab("friends")}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        activeTab === "friends"
                          ? colors.text
                          : colors.textSecondary,
                    },
                  ]}
                >
                  Friends
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "requests" && {
                    borderBottomColor: colors.accent,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setActiveTab("requests")}
              >
                <View style={styles.tabWithBadge}>
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          activeTab === "requests"
                            ? colors.text
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    Requests
                  </Text>
                  {requests.length > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.badgeText}>{requests.length}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "sent" && {
                    borderBottomColor: colors.accent,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setActiveTab("sent")}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        activeTab === "sent"
                          ? colors.text
                          : colors.textSecondary,
                    },
                  ]}
                >
                  Sent ({sentRequests.length})
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={data}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmpty}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.accent}
                />
              }
            />
          </>
        )}
      </SafeAreaView>
    </BackgroundWrapper>
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
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  friendDetails: {
    marginLeft: 12,
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "500",
  },
  screenName: {
    fontSize: 13,
    marginTop: 1,
  },
  pendingLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  addButton: {
    padding: 10,
    borderRadius: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  tabWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "600",
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: "rgba(255, 255, 255, 0.5)",
  },
  updateContent: {
    fontSize: 13,
    marginTop: 2,
  },
  updateMeta: {
    alignItems: "flex-end",
    gap: 6,
  },
  timeAgo: {
    fontSize: 11,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
