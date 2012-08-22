/**
 * Module dependencies.
 */

var express = require('express')
  , sio = require('socket.io');

/**
 * App.
 */

var app = express.createServer();

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
}

app.listen(3000, function () {
  var addr = app.address();
  console.log('   app listening on http://' + addr.address + ':' + addr.port);
});

/**
 * Socket.IO server (single process only)
 */

var io = sio.listen(app)
  , nicknames = {}, ids = {};

/**
 * Recursos que el servidor manejará
 * Se acceden de la forma
 * sharedResources[<resourceID>]
 */
var sharedResources = {}; //Vacío por default
/**
 * Variable para manajear las votaciones
 * la llave es el resourceID
 * el valor es un objeto de la forma 
 * {'required':<int>,'votes':{}}
 * required : votos necesarios para aceptar el request
 * votes: arreglo con el tamaño igual a los usuarios conectados
 * La llave en votes es el sessionID
 * Los valores son como siguen:
 *  0: Sin votar
 *  1: Voto a favor
 *  -1: Voto en contra
 */
var voting = {};

io.sockets.on('connection', function (socket) {
    
      
/**
 * Función para revisar y avisar si una votación es aceptada
 * recibe el id del recurso que está siendo votado:
 * checkVoting(<resourceID>);
 */
var checkVoting = function(resID){
    console.log(voting);
    var accept = 0;
    var reject = 0;
    var total = 0;
    for(var i in voting[resID].votes){
        if(voting[resID].votes[i]==1){
            accept++;
        }else if(voting[resID].votes[i]==-1){
            reject++;
        }
        total++;
    }
    console.log('VOTES: ', accept, reject);
    if(accept>=voting[resID].required){
        //Se completaron los votos requeridos para aceptar la versión
	console.log("shared", sharedResources);
	sharedResources[resID].push(voting[resID].version.version);
        io.sockets.in(resID).emit('commitAccepted',{message:'La version ha sido aceptada', data: voting[resID].version});
	io.sockets.in(resID).emit('log',{message:'La version ha sido aceptada'});
        //socket.emit('commitAccepted');
        //Avisar a todos @todo
        //Borrar la votación
        delete(voting[resID]);
    }else if(accept + reject == total){
        //Ya todos votaron y no hubo suficientes votos para aceptar el commit
        io.sockets.in(resID).emit('commitRejected',{message:'No se obtuvieron los votos suficientes'});
        //socket.emit('commitRejected',{message:'No se obtuvieron los votos suficientes'});
        //Avisar a todos @todo
        //Borrar la votación
        delete(voting[resID]);
    }
}

/**
 * Función para guardar cosas en el log y avisar a los usuarios
 */
var log = function(line){
    //Save somehow the log
    console.log('LOG: ', line);
    //tell everyone within the group to do the same
    socket.get('resourceID',function(err,group){
        io.sockets.in(group).emit('log',{'message':line});
    });
    
}
	
	socket.on('bind', function(data,fn){//Un nuevo cliente quiere ser asociado con un recurso
		//Guardar el id del recurso como parte del socket
		//socket.resourceID = data.sharedID;
		socket.set('resourceID',data.resourceID,function(){});
		socket.get('resourceID',function(err,group){
			socket.join(group);
                        if(typeof voting[group] === 'undefined'){
                            
                        }else{
                            voting[group].required++;
                            voting[group].votes[socket.id] = 0;
                        }
		});
		//send ack
		log('Usuario con id' + socket.id + ' conectado.');    
		fn({success:true});
	});
	
	socket.on('checkout', function(data, fn){
		socket.get('resourceID',function(err, id){
			if(typeof sharedResources[id] === 'undefined'){
				//No version has been stored
				//Store this version and ack the current user
				sharedResources[id] = []
				sharedResources[id].push(data.version);
				fn({exists:false});
			}else if(data.requestedVersion > -1){
				fn({exists:true,baseLine:sharedResources[id][data.requestedVersion]});
				log('Checkout de la version solicitada ' +  data.requestedVersion);    
			}else{
				//There's already a version stored
				//ACK the current user
				var index = sharedResources[id].length + 1;
				fn({exists:true,baseLine:sharedResources[id][index]});
				log('Checkout de la version ' +  index);    
			}
		});
	});
	
	socket.on('bfCommit', function(data, fn){
		socket.get('resourceID',function(err, id){
			sharedResources[id] = data.version;
		});
		fn({});
	});
	
	socket.on('test',function(data){
		console.log(socket);
	});

	socket.on('requestCommit', function(data, fn){
		//Un cliente quiere hacer commit de su versión local
                socket.get('resourceID',function(err, resourceID){
                    //Revisar si no existe una votación para este recurso ya
                    var peers = io.sockets.clients(resourceID);
                    if(typeof voting[resourceID] === 'undefined'){
                        //Crear la votación
                        var reqVotes = peers.length;
                        console.log('REQUEST:' + reqVotes);
                        if(reqVotes == 1){
                            //Sólo hay un usuario y no es requerida la votación
                            //Guardar la versión y avisar al usuario
                            socket.get('resourceID',function(err, resourceID){
                                
                                socket.emit("commitAccepted",{});
                                console.log('New version ['+ resourceID + ']:');
                                console.log(sharedResources[resourceID]);
                            });
                            
                        }else{
                            var votes = {};
                            for(var i in peers){
                                votes[peers[i].id] = 0; //Sin votar por default
                            }
                            votes[socket.id] = 1;
                            voting[resourceID] = {
                                'peer': socket.id,
                                'required': reqVotes,
                                'votes': votes,
				'version' : data
                            };
                            //Avisar a todos del commit
                            socket.broadcast.to(resourceID).emit('commitAsked',data);
                        }
                    }else{
                        //Ya existe una votación en curso
                        socket.emit('commitRejected',{'message':'Ya hay una votacion en proceso'});
                    }
                    log('Usuario con id' + socket.id + ' solicitó commit de su versión');
		});
                
                
		//Preguntar a los demás en el room por si están de acuerdo
                /*
		var peersResponse = {};
		var i = 0;
		socket.get('resourceID',function(err, group){
			/* *
			io.sockets.emit('commitAsked', data, function(response){
				console.log('Someone actually responded:',response);
				peersRespone[i++] = response;
			});
			/* *
			socket.broadcast.to(group).emit('commitAsked',data,function(response){
				console.log('>>>>>>>>>>Someone actually responded:',response);
				peersResponse[i++] = response;
				//console.log(response);
			});
			/* *
                        socket.broadcast.to(group).emit('commitAsked',data,function(response){
				console.log('>>>>>>>>>>Someone actually responded:',response);
				peersResponse[i++] = response;
				//console.log(response);
			});
		});
                */
		//fn(peersResponse);
	});
	
	socket.on('disconnect', function(){
		//Un cliente se desconectó
		//Revisar si ya no queda nadie más dentro de su grupo para borrar el recurso
		socket.get('resourceID',function(err,group){
			var remainingPeers = io.sockets.clients(group).length - 1;
			if(remainingPeers == 0){
				//Dumpear recurso
                                console.log('Dumping resource: '+group);
				delete(sharedResources[group]);
                                //Borrar la votación que haya quedado pendienete
                                if(!(typeof voting[group] === 'undefined')){
                                    delete(voting[group]);
                                }
			}else{
                            //var peers = io.sockets.clients(resourceID);
                            //Disminuir el número de votos necesarios para
                            //aceptar una versión votada
                            //La política para disminuir votos podría cambiar
                            if(!(typeof voting[group] === 'undefined')){
                                voting[group]['required']--;
                                //Borrar el voto de este usuario
                                delete(voting[group]['votes'][socket.id]);
                                //Evaluar de nuevo la votación
                                checkVoting(group);
                            }
                        }
		});
                log('Usuario con id' + socket.id + ' desconectado.');
	});
        
        socket.on('vote',function(data){
            socket.get('resourceID',function(err,group){
                if(data.vote){
                    //Marcar el voto de este usuario a favor
                    voting[group].votes[socket.id]=1;
                }else{
                    voting[group].votes[socket.id]=-1;
                }
                console.log('Vote: ' + data.vote);
                checkVoting(group);
            });
        });
        
        socket.on('log', function(data){
            socket.get('resourceID',function(err,group){
                log(data.message);
            });
        })
});