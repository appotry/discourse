# frozen_string_literal: true

require 'rails_helper'

describe PresenceController do
  fab!(:user) { Fabricate(:user) }
  let(:ch1) { PresenceChannel.new('ch1') }
  let(:ch2) { PresenceChannel.new('ch2') }

  before { PresenceChannel.clear_all! }
  after { PresenceChannel.clear_all! }

  describe "#update" do
    it "works" do
      sign_in(user)
      client_id = SecureRandom.hex

      expect(ch1.user_ids).to eq([])
      expect(ch2.user_ids).to eq([])

      post "/presence/update.json", params: {
        client_id: client_id,
        present_channels: ["ch1", "ch2"]
      }
      expect(response.status).to eq(200)
      expect(ch1.user_ids).to eq([user.id])
      expect(ch2.user_ids).to eq([user.id])

      post "/presence/update.json", params: {
        client_id: client_id,
        present_channels: ["ch1"],
        leave_channels: ["ch2"]
      }
      expect(response.status).to eq(200)
      expect(ch1.user_ids).to eq([user.id])
      expect(ch2.user_ids).to eq([])

      post "/presence/update.json", params: {
        client_id: client_id,
        present_channels: [],
        leave_channels: ["ch1"]
      }
      expect(response.status).to eq(200)
      expect(ch1.user_ids).to eq([])
      expect(ch2.user_ids).to eq([])
    end
  end

  describe "#get" do
    let(:user2) { Fabricate(:user) }
    let(:user3) { Fabricate(:user) }

    it "works" do
      get "/presence/get", params: { channel: ch1.name }
      expect(response.status).to eq(200)
      body = response.parsed_body
      expect(body["users"]).to eq([])
      expect(body["count"]).to eq(0)
      expect(body["last_message_id"]).to eq(MessageBus.last_id(ch1.message_bus_channel_name))

      ch1.present(user_id: user.id, client_id: SecureRandom.hex)
      ch1.present(user_id: user2.id, client_id: SecureRandom.hex)
      ch1.present(user_id: user3.id, client_id: SecureRandom.hex)

      get "/presence/get", params: { channel: ch1.name }
      body = response.parsed_body
      puts body.to_json
      expect(body["users"].map { |u| u["id"] }).to contain_exactly(user.id, user2.id, user3.id)
      expect(body["users"][0].keys).to contain_exactly("avatar_template", "id", "name", "username")
      expect(body["count"]).to eq(3)
      expect(body["last_message_id"]).to eq(MessageBus.last_id(ch1.message_bus_channel_name))
    end

  end

end
