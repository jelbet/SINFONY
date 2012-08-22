/*!
 * Sinfony JavaScript Library v0
 * http://Sinfony.prototype.org
 *
 * Copyright 2012, Eduardo Cruz, Fernando Alvarez
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://Sinfony.prototype.org/license
 *
 * Date: Mon Fri 29 21:11:03 2011 -0600
 */

function Sinfony(jqElement, resourceID){
	
	var instance = this;
	
	//Elemento cuyo valor será comparado con el de otros clientes
	this.boundElement = jqElement;
	
	//ID alfanumérico que usan todos los clientes que compartan el texto
	this.resourceID = resourceID;
	
	//Booleano para saber si el server está consciente de que el cliente está
	//conectado
	this.connected = false;
	
	//Función para conectarse al servidor
	this.connect = function (server, options){
		//@todo
		//Check if boundElement y sharedID están definidos. Loggear el error
		//en caso contrario
		if(typeof this.boundElement === 'undefined' || 
			typeof this.resourceID === 'undefined'){
			console.error('boundElement or resourceID are not defined');
		}
		//Crear socket
		this.socket = io.connect(server, options);
		
		//Hablar con el server para decirle que recurso maneja este cliente
		//this.socket.emit('test',"my:'data'"); //@legacyCode
		this.socket.emit('bind',
		{resourceID:this.resourceID},
		function(data){
			//@todo Mover esta callback a otro lado para simplificar el código
			this.connected = data.success;
		});
		/*
		this.socket.on('commitAsked',function(data,serverfn){
			//alert('successful commit');
			console.log(data);
			//Decidir si se acepta o no el commit y regresar la respuesta
			//return {response:false};

			serverfn({response:false});
			//serverfn(callback(data));
		});
		*/
		//Bindear los callbacks asignados para la comunicación con el server
		//	Respuesta del server cuando se ha logrado conectar al cliente
		/*
		this.socket.on('bind',function(data){
			this.connected = true;
		});
		*/
		//	Respuesta del servidor cuando un cliente pregunta por la versión de 
		//la sesión de trabajo actual
		/*
		this.socket.on('checkout',function(data){
			if(data.exists){//Significa que el server tiene una versión ya
				//Cambiar la versión local por la recibida desde el servidor
				this.boundElement.val(data.value);
			}else{//Significa que este es el primer cliente que se conecta con
				//ese resourceID
				//Hacer nada
			}
		});
		*/
	}
	
	
	
	this.checkout = function(fn){
		//@todo
		//Preguntar al servidor si es que hay una versión más nueva de este
		//recurso y recuperarla para sustituir la copia local por ésta
		this.socket.emit('checkout',{version:this.boundElement.val()},function(data){
			if(data.exists){//Significa que el server tiene una versión ya
				//Cambiar la versión local por la recibida desde el servidor
				instance.boundElement.val(data.baseLine);
				//rtLoad(instance.boundElement.val());
                                if(typeof fn === 'undefined'){
                                    //Llamar el callback en caso de que lo haya
                                    //fn();
                                }else{
                                    fn();
                                }
			}else{//Significa que este es el primer cliente que se conecta con
				//ese resourceID
				//Hacer nada
			}
		});
	}
	
	this.alert = function(){
		//Función de prueba para jquery
		alert(this.boundElement.val());
	}
	
	//Función para hacer commit de los cambios locales
	this.requestCommit = function(callback){
		//@todo
		//Hablar con el server para mandar los cambios
                
                var data = this.boundElement.val().toString().replace(/\"/g, "'");
                console.log("sent data", data);
		this.socket.emit('requestCommit',
		{version:this.boundElement.val()},
		callback);
		//Poner un timer o algo así para detener la ejecición
		//Regresar true si el server aceptó y el commit está en proceso de
		//ser aceptado
		//Regresar false si el server no aceptó el commit
		//(por si había otro commit, por ejemplo)
	}
	
	//Función que vota "si" o "no" al request actual de commit
	this.voteCommit = function(choice){
		
	}
	
	//Función que cambia momentaneamente la versión local por la candidata a
	//linea base
	this.commitPreview = function(){
		
	}
	
	//Función que realiza una petición de rollback a los demás peers
	this.requestRollback = function(){
		
	}
	
	//Función con propósitos demostrativos
	this.bfCommit = function(){
		this.socket.emit('bfCommit',{version:this.boundElement.val()},function(data){});
	}
        
        //Callbacks
        this.commitAsked = function(callback){
		this.socket.on('commitAsked',function(data/*,serverfn*/){
			
			//serverfn(callback(data));
                        callback(data);
		});
	}
        
        this.commitRejected = function(fn){
            this.socket.on('commitRejected',function(data/*,serverfn*/){
                fn(data);
                //console.log(serverfn,callback);
                //serverfn(callback(data));
            });
        }
        
        this.commitAccepted = function(fn){
            this.socket.on('commitAccepted',function(data,serverfn){
                fn(data);
                //console.log(serverfn,callback);
                //serverfn(callback(data));
            });
        }
        
        this.vote = function(vote){
            this.socket.emit('vote',{'vote':vote});
        };
        
        this.sendLog = function(message){
            this.socket.emit('log',{'message':message});
        };
        
        this.recieveLog = function(fn){
            this.socket.on('log',function(data){
                fn(data);
            });
        }
        this.rawLog = function(element){
            //Element must be a jquery element object
            this.socket.on('log',function(data){
                element.prepend($('<div>').text(data.message));
            });
        }
}