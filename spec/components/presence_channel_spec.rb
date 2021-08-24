# frozen_string_literal: true

require 'rails_helper'
require 'presence_channel'

describe PresenceChannel do
  before { PresenceChannel.clear_all! }
  after { PresenceChannel.clear_all! }

  fab!(:u1) { Fabricate(:user) }
  fab!(:u2) { Fabricate(:user) }

  it "can perform basic channel functionality" do
    # 10ms timeout for testing
    channel1 = PresenceChannel.new("test")
    channel2 = PresenceChannel.new("test")
    channel3 = PresenceChannel.new("test")

    expect(channel3.user_ids).to eq([])

    channel1.present(user_id: u1.id, client_id: 1)
    channel2.present(user_id: u1.id, client_id: 2)

    expect(channel3.user_ids).to eq([1])
    expect(channel3.count).to eq(1)

    channel1.leave(user_id: u1.id, client_id: 2)

    expect(channel3.user_ids).to eq([1])
    expect(channel3.count).to eq(1)

    channel2.leave(user_id: u1.id, client_id: 1)

    expect(channel3.user_ids).to eq([])
    expect(channel3.count).to eq(0)
  end

  it "can automatically expire users" do

    channel = PresenceChannel.new("test")

    channel.present(user_id: u1.id, client_id: 76)
    channel.present(user_id: u1.id, client_id: 77)

    expect(channel.count).to eq(1)

    freeze_time Time.zone.now + 1 + PresenceChannel::DEFAULT_TIMEOUT

    expect(channel.count).to eq(0)
  end

  it "correctly sends messages to message bus" do
    channel = PresenceChannel.new("test")

    messages = MessageBus.track_publish(channel.message_bus_channel_name) do
      channel.present(user_id: u1.id, client_id: "a")
    end

    data = messages.map(&:data)
    expect(data.count).to eq(1)
    expect(data[0].keys).to contain_exactly("entering_users")
    expect(data[0]["entering_users"].map { |u| u[:id] }).to contain_exactly(1)

    freeze_time Time.zone.now + 1 + PresenceChannel::DEFAULT_TIMEOUT

    messages = MessageBus.track_publish(channel.message_bus_channel_name) do
      channel.auto_leave
    end

    data = messages.map(&:data)
    expect(data.count).to eq(1)
    expect(data[0].keys).to contain_exactly("leaving_user_ids")
    expect(data[0]["leaving_user_ids"]).to contain_exactly(1)
  end

  it "can track active channels, and auto_leave_all successfully" do
    channel1 = PresenceChannel.new("test1")
    channel2 = PresenceChannel.new("test2")

    channel1.present(user_id: u1.id, client_id: "a")
    channel2.present(user_id: u1.id, client_id: "a")

    start_time = Time.zone.now

    freeze_time start_time + PresenceChannel::DEFAULT_TIMEOUT / 2

    channel2.present(user_id: u2.id, client_id: "b")

    freeze_time start_time + PresenceChannel::DEFAULT_TIMEOUT + 1

    messages = MessageBus.track_publish do
      PresenceChannel.auto_leave_all
    end

    expect(messages.map { |m| [ m.channel, m.data ] }).to contain_exactly(
      ["/presence/test1", { "leaving_user_ids" => [1] }],
      ["/presence/test2", { "leaving_user_ids" => [1] }]
    )

    expect(channel1.user_ids).to eq([])
    expect(channel2.user_ids).to eq([2])
  end

  it 'only sends one `enter` and `leave` message' do
    channel = PresenceChannel.new("test")

    messages = MessageBus.track_publish(channel.message_bus_channel_name) do
      channel.present(user_id: u1.id, client_id: "a")
      channel.present(user_id: u1.id, client_id: "a")
    end

    data = messages.map(&:data)
    expect(data.count).to eq(1)
    expect(data[0].keys).to contain_exactly("entering_users")
    expect(data[0]["entering_users"].map { |u| u[:id] }).to contain_exactly(1)

    messages = MessageBus.track_publish(channel.message_bus_channel_name) do
      channel.leave(user_id: u1.id, client_id: "a")
      channel.leave(user_id: u1.id, client_id: "a")
    end

    data = messages.map(&:data)
    expect(data.count).to eq(1)
    expect(data[0].keys).to contain_exactly("leaving_user_ids")
    expect(data[0]["leaving_user_ids"]).to contain_exactly(1)
  end

  it "will return the messagebus last_id in the state payload" do
    channel = PresenceChannel.new("test1")

    channel.present(user_id: u1.id, client_id: "a")
    channel.present(user_id: u2.id, client_id: "a")

    state = channel.state
    expect(state.user_ids).to contain_exactly(1, 2)
    expect(state.count).to eq(2)
    expect(state.message_bus_last_id).to eq(MessageBus.last_id(channel.message_bus_channel_name))
  end

  it "sets an expiry on all channel-specific keys" do
    r = Discourse.redis.without_namespace
    channel = PresenceChannel.new("test1")
    channel.present(user_id: u1.id, client_id: "a")

    channels_ttl = r.ttl(PresenceChannel.redis_key_channel_list)
    expect(channels_ttl).to eq(-1) # Persistent

    initial_zlist_ttl = r.ttl(channel.send(:redis_key_zlist))
    initial_hash_ttl = r.ttl(channel.send(:redis_key_hash))

    expect(initial_zlist_ttl).to be_between(PresenceChannel::GC_SECONDS, PresenceChannel::GC_SECONDS + 5.minutes)
    expect(initial_hash_ttl).to be_between(PresenceChannel::GC_SECONDS, PresenceChannel::GC_SECONDS + 5.minutes)

    freeze_time 1.minute.from_now

    # PresenceChannel#present is responsible for bumping ttl
    channel.present(user_id: u1.id, client_id: "a")

    new_zlist_ttl = r.ttl(channel.send(:redis_key_zlist))
    new_hash_ttl = r.ttl(channel.send(:redis_key_hash))

    expect(new_zlist_ttl).to be > initial_zlist_ttl
    expect(new_hash_ttl).to be > initial_hash_ttl
  end

end
