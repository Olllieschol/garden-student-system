require 'socket'
require 'uri'

server = TCPServer.new('0.0.0.0', 3000)
puts "Serving on port 3000"
$stdout.flush

MIME_TYPES = {
  '.html' => 'text/html',
  '.css' => 'text/css',
  '.js' => 'application/javascript',
  '.png' => 'image/png',
  '.jpg' => 'image/jpeg',
  '.svg' => 'image/svg+xml',
  '.ico' => 'image/x-icon',
}

ROOT = File.dirname(__FILE__)

loop do
  client = server.accept
  begin
    request = client.gets
    next unless request
    path = URI.decode_www_form_component(request.split(' ')[1])
    path = '/index.html' if path == '/'
    file_path = File.join(ROOT, path)
    if File.exist?(file_path) && !File.directory?(file_path)
      ext = File.extname(file_path)
      content_type = MIME_TYPES[ext] || 'application/octet-stream'
      body = File.binread(file_path)
      client.print "HTTP/1.1 200 OK\r\nContent-Type: #{content_type}\r\nContent-Length: #{body.bytesize}\r\n\r\n"
      client.print body
    else
      client.print "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nNot Found"
    end
  rescue => e
    client.print "HTTP/1.1 500 Error\r\nContent-Type: text/plain\r\n\r\n#{e.message}" rescue nil
  ensure
    client.close
  end
end
